import {
  default as makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  WASocket
} from '@whiskeysockets/baileys';
import * as qrcode from 'qrcode-terminal';
import * as admin from 'firebase-admin';
import { 
  WhatsAppConnectionConfig,
  WhatsAppConnectionStatus,
  SendMessageResult 
} from './types';

export class WhatsAppConnection {
  private sock?: WASocket;
  private isConnected = false;
  private isAuthenticated = false;
  private userInfo: any = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  private readonly BASE_RECONNECT_DELAY = 5000;
  private readonly MAX_RECONNECT_DELAY = 60000;
  private reconnectTimeout?: NodeJS.Timeout;
  private isReconnecting = false;
  private connectionState: string = "disconnected";
  private currentQR?: string;
  private lastQRTime?: Date;
  private config: WhatsAppConnectionConfig;
  private firebaseApp?: admin.app.App;

  constructor(config: WhatsAppConnectionConfig) {
    this.config = {
      printQRInTerminal: true,
      useFirebaseAuth: true,
      authPath: 'auth_info_baileys',
      ...config
    };
  }

  private calculateReconnectDelay(): number {
    const delay = Math.min(
      this.BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
      this.MAX_RECONNECT_DELAY
    );
    return delay + Math.random() * 1000;
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.log("🔴 Max reconnect attempts reached. Stopping reconnection.");
      this.isReconnecting = false;
      return;
    }

    if (this.isReconnecting) {
      console.log("🔄 Reconnection already in progress, skipping");
      return;
    }

    this.isReconnecting = true;
    const delay = this.calculateReconnectDelay();
    console.log(
      `🔄 Scheduling reconnection attempt ${
        this.reconnectAttempts + 1
      }/${this.MAX_RECONNECT_ATTEMPTS} in ${delay}ms`
    );

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectAttempts++;
      await this.connect();
    }, delay);
  }

  private resetReconnectState(): void {
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
  }

  private async getAuthState() {
    let state: any, saveCreds: any;

    if (this.config.useFirebaseAuth && this.firebaseApp) {
      try {
        console.log("🔥 Attempting Firebase authentication...");
        // Note: You'll need to implement Firebase auth state logic here
        // For now, falling back to file-based auth
        throw new Error('Firebase auth not implemented in this version');
      } catch (firebaseError) {
        console.log("❌ Firebase authentication failed:", (firebaseError as Error).message);
        console.log("🔄 Falling back to file-based authentication...");
      }
    }

    // File-based authentication fallback
    const fileResult = await useMultiFileAuthState(this.config.authPath || 'auth_info_baileys');
    state = fileResult.state;
    saveCreds = fileResult.saveCreds;
    console.log("📁 Using file-based authentication");

    return { state, saveCreds };
  }

  async connect(): Promise<void> {
    try {
      console.log("🚀 Attempting to connect to WhatsApp...");
      console.log("🔐 Loading authentication state...");

      const { state, saveCreds } = await this.getAuthState();

      this.sock = makeWASocket({
        auth: state,
        connectTimeoutMs: 90000,
        defaultQueryTimeoutMs: 60000,
        printQRInTerminal: false,
        qrTimeout: 60000,
        retryRequestDelayMs: 1000,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        browser: ["Whaple SDK", "Chrome", "1.0.0"],
      });

      this.sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        const connectionEmoji =
          connection === "open"
            ? "🟢"
            : connection === "connecting"
            ? "🟡"
            : "🔴";
        console.log(`${connectionEmoji} Connection update:`, {
          connection,
          qr: !!qr,
          lastDisconnect: lastDisconnect?.error?.message,
        });

        if (qr && this.connectionState !== "waiting_for_qr") {
          this.currentQR = qr;
          this.lastQRTime = new Date();
          this.connectionState = "waiting_for_qr";
          console.log("\n🟠 === NEW QR CODE RECEIVED === 🟠");
          if (this.config.printQRInTerminal) {
            qrcode.generate(qr, { small: true });
          }
          console.log("🟠 ================================ 🟠\n");
          this.isAuthenticated = false;
          this.isConnected = false;
          this.resetReconnectState();
        }

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.log("\n🔴 === CONNECTION CLOSED === 🔴");
          console.log("⚠️ Reason:", lastDisconnect?.error?.message || "Unknown");
          console.log("🔢 Status code:", statusCode);
          console.log("🔄 Should reconnect:", shouldReconnect);
          console.log("🔴 ======================== 🔴\n");

          this.isConnected = false;
          this.connectionState = "disconnected";
          this.isReconnecting = false;

          if (statusCode === DisconnectReason.loggedOut) {
            console.log("🚫 Logged out - clearing auth and requiring new QR scan");
            this.isAuthenticated = false;
            this.userInfo = null;
            this.currentQR = undefined;
            this.lastQRTime = undefined;
            this.resetReconnectState();
          } else if (statusCode === DisconnectReason.restartRequired) {
            console.log("🔁 Restart required - reconnecting immediately");
            this.reconnectAttempts = 0;
            setTimeout(() => this.scheduleReconnect(), 1000);
          } else if (shouldReconnect && !this.isReconnecting) {
            console.log("⚠️ Connection issue - scheduling reconnect with backoff");
            this.scheduleReconnect();
          } else {
            console.log("⏹️ Not reconnecting due to permanent error or already reconnecting");
            this.resetReconnectState();
          }
        } else if (connection === "open") {
          console.log("\n🟢 === CONNECTION SUCCESSFUL === 🟢");
          console.log("✅ WhatsApp connected successfully!");
          this.isConnected = true;
          this.isAuthenticated = true;
          this.connectionState = "connected";
          this.currentQR = undefined;
          this.lastQRTime = undefined;
          this.resetReconnectState();

          if (this.sock?.user) {
            this.userInfo = {
              id: this.sock.user.id,
              name: this.sock.user.name || this.sock.user.verifiedName || "Unknown",
            };
            console.log("👤 Authenticated as:", this.userInfo.name, "(" + this.userInfo.id + ")");
          }
          console.log("🚀 Status: READY FOR MESSAGES");
          console.log("🟢 ============================= 🟢\n");
        } else if (connection === "connecting") {
          console.log("🔄 Connecting to WhatsApp...");
          this.connectionState = "connecting";
          this.isConnected = false;
        }
      });

      this.sock.ev.on("creds.update", (creds: any) => saveCreds(creds));
    } catch (error) {
      console.error("❌ Error during WhatsApp connection setup:", error);
      this.isConnected = false;
      this.isAuthenticated = false;
      this.scheduleReconnect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch (error) {
        console.log("Error closing socket:", (error as Error).message);
      }
    }
    this.isConnected = false;
    this.isAuthenticated = false;
    this.resetReconnectState();
  }

  async forceReconnect(): Promise<void> {
    this.isConnected = false;
    this.isAuthenticated = false;
    this.userInfo = null;
    this.currentQR = undefined;
    this.lastQRTime = undefined;
    this.resetReconnectState();

    await this.disconnect();

    setTimeout(() => {
      this.connect();
    }, 1000);
  }

  async resetAuthentication(): Promise<void> {
    this.isConnected = false;
    this.isAuthenticated = false;
    this.userInfo = null;
    this.currentQR = undefined;
    this.lastQRTime = undefined;
    this.resetReconnectState();

    await this.disconnect();

    setTimeout(() => {
      this.connect();
    }, 2000);
  }

  getConnectionStatus(): WhatsAppConnectionStatus {
    return {
      isConnected: this.isConnected,
      isAuthenticated: this.isAuthenticated,
      userInfo: this.userInfo,
      reconnectAttempts: this.reconnectAttempts,
      isReconnecting: this.isReconnecting,
      connectionState: this.connectionState,
      currentQR: this.currentQR,
      lastQRTime: this.lastQRTime,
    };
  }

  getCurrentQR(): string | undefined {
    return this.currentQR;
  }

  async sendMessage(number: string, message: string): Promise<SendMessageResult> {
    console.log(`🔍 sendMessage called with number: ${number}, message length: ${message.length}`);
    
    if (!this.isConnected || !this.sock) {
      console.log(`❌ WhatsApp not ready - Connected: ${this.isConnected}, Sock: ${!!this.sock}`);
      throw new Error('WhatsApp not connected');
    }
    
    // Clean and format the number
    const cleanNumber = number.replace(/[^\d]/g, ''); // Remove non-digits
    const formattedNumber = cleanNumber.includes('@') ? cleanNumber : `${cleanNumber}@s.whatsapp.net`;
    
    console.log(`📱 Original number: ${number}`);
    console.log(`📱 Clean number: ${cleanNumber}`);
    console.log(`📱 Formatted number: ${formattedNumber}`);
    console.log(`📨 Message preview: ${message.substring(0, 50)}...`);
    
    try {
      console.log(`🚀 Calling sock.sendMessage...`);
      const result = await this.sock.sendMessage(formattedNumber, { text: message });
      console.log(`✅ sock.sendMessage completed:`, result);
      
      return {
        success: true,
        method: 'direct',
        messageId: result?.key?.id || `direct-${Date.now()}`,
        timestamp: Date.now(),
        key: result
      };
    } catch (error) {
      console.error(`❌ sock.sendMessage failed:`, error);
      throw error;
    }
  }

  async getMessageHistory(number: string, limit: number = 20): Promise<any> {
    console.log(`📖 getMessageHistory called with number: ${number}, limit: ${limit}`);
    
    if (!this.isConnected || !this.sock) {
      console.log(`❌ WhatsApp not ready for message history - Connected: ${this.isConnected}, Sock: ${!!this.sock}`);
      throw new Error('WhatsApp not connected');
    }
    
    // Clean and format the number
    const cleanNumber = number.replace(/[^\d]/g, '');
    const formattedNumber = cleanNumber.includes('@') ? cleanNumber : `${cleanNumber}@s.whatsapp.net`;
    
    console.log(`📱 Getting history for: ${formattedNumber}`);
    
    try {
      // Try to get chat messages using Baileys methods
      // Note: This is a basic implementation, actual message history retrieval
      // may require different approaches depending on Baileys version
      
      console.log(`📖 Attempting to fetch chat history...`);
      
      // Method 1: Try to get existing chat
      const chatId = formattedNumber;
      const messages = await this.sock.chatModify(
        { star: { messages: [], star: false } },
        chatId
      ).catch(() => null);
      
      if (messages) {
        console.log(`📖 Found chat history via chatModify`);
        const messageArray = Array.isArray(messages) ? messages : [];
        return {
          success: true,
          number: formattedNumber,
          messageCount: messageArray.length,
          messages: messageArray.slice(0, limit),
          method: 'chatModify',
          timestamp: Date.now()
        };
      }
      
      // Method 2: Fallback - return empty but successful response
      console.log(`📖 No messages found, returning empty history`);
      return {
        success: true,
        number: formattedNumber,
        messageCount: 0,
        messages: [],
        note: 'No message history available or chat not found',
        method: 'fallback',
        timestamp: Date.now()
      };
      
    } catch (error) {
      console.error(`❌ getMessageHistory failed:`, error);
      throw error;
    }
  }

  setFirebaseApp(firebaseApp: admin.app.App): void {
    this.firebaseApp = firebaseApp;
  }

  async getQueueStatus(): Promise<any> {
    // This method should be implemented to get queue status from Firebase
    // For now, return a basic status
    return {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      isProcessing: false
    };
  }
}