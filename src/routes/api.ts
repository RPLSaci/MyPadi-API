import Router from "express";
const router = Router();
import jwt, {JwtPayload} from "jsonwebtoken";
import bcrypt from "bcrypt";
import cheerio from "cheerio"
import {model} from "../db/model/userpadi.js";
import {userInfo} from "../db/model/userInfo.js";
const User = model;
import type{ berita } from "../util/interfaces.js";
import OpenAI from "openai";

const AI = new OpenAI({
  apiKey: process.env.OpenAI_KEY,
});

let cachedQuestion:any = {}
// AI.chat.completions.create

import OpenWeatherAPI from "openweather-api-node";
import "dotenv/config.js"
import { baseUrlDetik, endpointDetik, stringDetik } from "../util/detik.js";

const weather = new OpenWeatherAPI({
  key:process.env.weatherkey,
  units:"metric"
})



router.get("/test", (req, res) =>{
  return res.status(200).json({message: "hello world"});
});



router.get("/ai/generateID", (req, res) =>{
  let id = generateRandomId(10)

  return res.status(200).json({
    message:id
  })
});


router.get("/berita/news", async (req, res) =>{
  const halaman = req.query.page || 1;
  const resp = await fetch(baseUrlDetik+endpointDetik.tag+`pertanian/?sortby=time&page=${halaman}`)
  const data = (await resp.text()!)

  if(resp.url.includes("searchall")){
    return res.status(200).send([])
  }

  const $ = cheerio.load(data)

  
  const returnData:Array<berita> = []
  $(stringDetik.listBerita).each((i,el)=>{
    let tanggal = $(el).find(".date").text().replace($(el).find(".category").text(),"")
    let judul = $(el).find(".title").text()
    let deskripsi = $(el).find(".box_text > p").text()
    let url = $(el).find("a").first().attr("href")!
    let img = $(el).find("img").first().attr("src")!
    returnData.push({
      title:judul,
      date:tanggal,
      description:deskripsi,
      url:url,
      image:img,
    })
  })
  return res.status(200).send(returnData)
});

router.post("/signup", async (req, res) => {
  if(JSON.parse(process.env.singup!) != true){
    res.status(503).json({error: "Maaf... Pendaftaran untuk beta sudah di tutup!"});
    return
  }
  try {
    const {username, password} = req.body;
    const existingUser = await User.findOne({username});
    if (existingUser) {
      return res.status(409).json({error: "Username sudah ada"});
    }
    const newUser = new User({username, password});
    await newUser.save();
    res.status(201).json({message: "Pendaftaran Berhasil"});
  } catch (error) {
    res.status(500).json({error: "Something went wrong"});
  }
});

router.post("/login", async (req, res) => {
  try {
    const {username, password} = req.body;
    const user = await User.findOne({username});
    if (!user) {
      return res.status(401).json({error: "Invalid credentials"});
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({error: "Invalid credentials"});
    }
    const token = jwt.sign({userId: user._id}, (process.env.SALT as string));
    res.status(200).json({token});
  } catch (error) {
    res.status(500).json({error: "Something went wrong"});
  }
});

router.get("/checkLogin", async (req, res) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({error: "No token provided"});
    }

    
    jwt.verify(token, (process.env.SALT as string), async (err, decoded) => {
      if (err) {
        return res.status(401).json({error: "Invalid token"});
      }

      const id = (decoded! as JwtPayload).userId;
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({error: "User not found"});
      }

      res.status(200).json({user: user.username});
    });
  } catch (error) {
    res.status(500).json({error: "Something went wrong"});
  }
});




router.post("/ai/ask", async (req, res) => {
  const id:string = req.body.id
  const question:string = req.body.question
  
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({error: "No token provided"});
    }
    
    jwt.verify(token, (process.env.SALT as string), async (err, decoded) => {
      if (err) {
        return res.status(401).json({error: "Invalid token"});
      }

      const id = (decoded! as JwtPayload).userId;
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({error: "User not found"});
      }
    });


  } catch (error) {
    res.status(500).json({error: "Something went wrong"});
  }

  if(!cachedQuestion[id]){
    cachedQuestion[id] = [
      {"role": "user", "content":`Kamu adalah Sebuah asisten AI bernama PAWI, kamu adalah asisten yang berkerja dalam sektor pertanian, kamu akan memberikan informasi yang berfokuskan kepada topik pertanian, kamu juga akan menilai seberapa "pertanian" pertanyaan user, jika pertanyaan user tidak ada unsur pertanian sama sekali, maka kamu harus menambahkan kata kata "-AKHIRI PEMBICARAAN-"!, tidak boleh terlewat. mulai percakapan dengan "ada yang bisa saya bantu ?"`},
      {"role": "assistant", "content": "Apakah Ada yang bisa saya bantu ?"},
    ]
  }

  cachedQuestion[id].push({"role": "user", "content":question})

  const response = await AI.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: cachedQuestion[id],
  });

  cachedQuestion[id].push({"role":"assistant","content":response.choices[0].message.content})

  res.status(200).json({"message":response.choices[0].message.content})
});

router.get("/userInfo", async (req,res) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({error: "No token provided"});
    }

    jwt.verify(token, (process.env.SALT as string), async (err, decoded) => {
      if (err) {
        return res.status(401).json({error: "Invalid token"});
      }

      const id = (decoded! as JwtPayload).userId;
      const user = await userInfo.findById(id);
      if (!user) {
        return res.status(404).json({error: "User not found"});
      }

      res.status(200).json({user: user.username,terakhirTanam:user.terakhirTanam,tipeTanaman:user.tipeTanaman});
    });
  } catch (error) {
    res.status(500).json({error: "Something went wrong"});
  }
});


router.post("/getLocation",async(req,res) =>{
  const {lat,long} = req.body;
  if(!lat || !long) {
    return res.status(400).json({message:"Not Found"})
  }

  weather.setLanguage("id")
  weather.setLocationByCoordinates(lat,long)
  const cond = await weather.getCurrent()
  const location = await weather.getLocation()

  
  return res.status(200).json({cond,location})
})
export default router;


function generateRandomId(length:number):string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    id += characters.charAt(randomIndex);
  }

  if(cachedQuestion[id]){
    return generateRandomId(length)
  }
  return id;
}

// Example usage: generate a random ID with a length of 8 characters

