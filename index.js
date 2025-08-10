"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthChecker = exports.ApiClient = exports.QueueManager = exports.Whaple = void 0;
var Whaple_1 = require("./src/Whaple");
Object.defineProperty(exports, "Whaple", { enumerable: true, get: function () { return Whaple_1.Whaple; } });
var QueueManager_1 = require("./src/QueueManager");
Object.defineProperty(exports, "QueueManager", { enumerable: true, get: function () { return QueueManager_1.QueueManager; } });
var ApiClient_1 = require("./src/ApiClient");
Object.defineProperty(exports, "ApiClient", { enumerable: true, get: function () { return ApiClient_1.ApiClient; } });
var HealthChecker_1 = require("./src/HealthChecker");
Object.defineProperty(exports, "HealthChecker", { enumerable: true, get: function () { return HealthChecker_1.HealthChecker; } });
__exportStar(require("./src/types"), exports);
// Default export for CommonJS compatibility
const Whaple_2 = require("./src/Whaple");
exports.default = Whaple_2.Whaple;
//# sourceMappingURL=index.js.map