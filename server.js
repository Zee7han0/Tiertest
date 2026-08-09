const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) console.warn("WARNING: ADMIN_PASSWORD is not set.");
const db = new Database(path.join(__dirname, "void.db"));
db.pragma("journal_mode = WAL");
db.exec(`CREATE TABLE IF NOT EXISTS players (username TEXT PRIMARY KEY COLLATE NOCASE,title TEXT NOT NULL,points INTEGER NOT NULL DEFAULT 0,region TEXT NOT NULL,tiers TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY,expires_at INTEGER NOT NULL);`);
app.use(express.json({limit:"100kb"})); app.use(cookieParser()); app.use(express.static(path.join(__dirname,"public")));
function isAdmin(req,res,next){const t=req.cookies.void_admin;if(!t)return res.status(401).json({error:"Admin login required"});const r=db.prepare("SELECT token FROM sessions WHERE token=? AND expires_at>? ").get(t,Date.now());if(!r)return res.status(401).json({error:"Admin session expired"});next();}
function clean(p){return {username:p.username,title:p.title,points:p.points,region:p.region,tiers:JSON.parse(p.tiers)}}
function validate(p){if(!p||typeof p.username!=="string"||!/^[A-Za-z0-9_]{1,16}$/.test(p.username))return "Invalid Minecraft username.";if(!["Combat Master","Combat Ace"].includes(p.title))return "Invalid title.";if(!Number.isInteger(p.points)||p.points<0)return "Points must be a non-negative integer.";if(!["NA","EU","AS","OC"].includes(p.region))return "Invalid region.";if(!p.tiers||typeof p.tiers!=="object")return "Tier data is required.";return null;}
app.get("/api/players",(req,res)=>res.json(db.prepare("SELECT * FROM players ORDER BY points DESC, username ASC").all().map(clean)));
app.post("/api/players",isAdmin,(req,res)=>{const p=req.body,e=validate(p);if(e)return res.status(400).json({error:e});try{db.prepare("INSERT INTO players(username,title,points,region,tiers) VALUES(?,?,?,?,?)").run(p.username,p.title,p.points,p.region,JSON.stringify(p.tiers));res.status(201).json({message:"Player added"});}catch{res.status(409).json({error:"That player already exists."})}});
app.delete("/api/players/:username",isAdmin,(req,res)=>{const r=db.prepare("DELETE FROM players WHERE username=?").run(req.params.username);if(!r.changes)return res.status(404).json({error:"Player not found."});res.json({message:"Player removed"})});
app.delete("/api/players",isAdmin,(req,res)=>{db.prepare("DELETE FROM players").run();res.json({message:"All players removed"})});
app.post("/api/admin/login",(req,res)=>{if(!ADMIN_PASSWORD||req.body.password!==ADMIN_PASSWORD)return res.status(401).json({error:"Incorrect password."});const t=crypto.randomBytes(32).toString("hex");db.prepare("INSERT INTO sessions(token,expires_at) VALUES(?,?)").run(t,Date.now()+43200000);res.cookie("void_admin",t,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:43200000});res.json({message:"Logged in"})});
app.post("/api/admin/logout",(req,res)=>{if(req.cookies.void_admin)db.prepare("DELETE FROM sessions WHERE token=?").run(req.cookies.void_admin);res.clearCookie("void_admin");res.json({message:"Logged out"})});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`Void Tiertests running on port ${PORT}`));