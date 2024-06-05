"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const mongodb_1 = require("mongodb");
const url = process.env.DB_URL;
let connectDB = new mongodb_1.MongoClient(url).connect();
exports.connectDB = connectDB;
