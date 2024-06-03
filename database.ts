import {MongoClient} from "mongodb";

const url = process.env.DB_URL as string;
let connectDB = new MongoClient(url).connect()

export {connectDB}