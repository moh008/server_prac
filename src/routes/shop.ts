//서버에서 분리된 api들 server.js와 달리 app.get이 아니라 router.get 인것 확인
const router = require('express').Router()
import {Db} from 'mongodb'
import {connectDB} from '../database' //src 폴더 / routes폴더의 코드이므로 위,위의 폴더에서 database.ts파일을 import

// db를 쓰기위해서는..
let db: Db;
connectDB.then((client)=>{
  db = client.db('forum');
  }).catch((err)=>{
  console.log(err)
})

// URL에서 공통적으로 /shop이 앞에 붙어서 api 정의할때마다 귀찮다면 ex)/shop/shirts, /shop/pants 
// /shop부분을 지워낸 후, server.js로 가서 app.use('/', require(routes/shop.js)에서 /를 /shop 으로 바꿔줌
router.get('/shirts', async (req: any, res: any) => {
  let rowCount = await db.collection('post').count()
  let result = await db.collection('post').find().sort({time: -1}).skip((req.params.page-1) * 10).limit(10).toArray()
  res.render('list.ejs',{글목록: result, 글수: rowCount, signed: req.session.passport?1:0, user: req.user?req.user:0} )
})

router.get('/pants', (req: any, res: any) => {
  res.send('바지파는 페이지임')
})

//마지막으로 module.exports = router 이렇게 해줘야 router변수에 담긴 express의 기능이 밖으로 빠져나오게 됨
module.exports =router