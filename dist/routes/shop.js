"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
//서버에서 분리된 api들 server.js와 달리 app.get이 아니라 router.get 인것 확인
const router = require('express').Router();
const database_1 = require("../database"); //src 폴더 / routes폴더의 코드이므로 위,위의 폴더에서 database.ts파일을 import
// db를 쓰기위해서는..
let db;
database_1.connectDB.then((client) => {
    db = client.db('forum');
}).catch((err) => {
    console.log(err);
});
// URL에서 공통적으로 /shop이 앞에 붙어서 api 정의할때마다 귀찮다면 ex)/shop/shirts, /shop/pants 
// /shop부분을 지워낸 후, server.js로 가서 app.use('/', require(routes/shop.js)에서 /를 /shop 으로 바꿔줌
router.get('/shirts', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let rowCount = yield db.collection('post').count();
    let result = yield db.collection('post').find().sort({ time: -1 }).skip((req.params.page - 1) * 10).limit(10).toArray();
    res.render('list.ejs', { 글목록: result, 글수: rowCount, signed: req.session.passport ? 1 : 0, user: req.user ? req.user : 0 });
}));
router.get('/pants', (req, res) => {
    res.send('바지파는 페이지임');
});
//마지막으로 module.exports = router 이렇게 해줘야 router변수에 담긴 express의 기능이 밖으로 빠져나오게 됨
module.exports = router;
