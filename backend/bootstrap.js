const express = require('express');
const originalListen = express.application.listen;
let capturedApp = null;
let capturedArgs = null;

express.application.listen = function (...args) {
  capturedApp = this;
  capturedArgs = args;
  return { close() {} };
};

require('./server');

express.application.listen = originalListen;
if (!capturedApp) throw new Error('WK Health backend failed to initialize Express app');
require('./features')(capturedApp, { db: require('better-sqlite3')(process.env.DB_PATH || '/var/data/wk-health.db'), auth: (req,res,next) => {
  const jwt = require('jsonwebtoken');
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return res.status(401).json({success:false,error:'ต้องเข้าสู่ระบบ'});
  try { req.user = jwt.verify(h.slice(7), process.env.JWT_SECRET || 'change-this-secret-in-render'); next(); }
  catch { return res.status(401).json({success:false,error:'เซสชันหมดอายุ'}); }
} });
originalListen.apply(capturedApp, capturedArgs);
