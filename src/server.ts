import 'dotenv/config'                              //환경변수들을 따로 .env 파일에 보관함
import {Callback, Db, ObjectId} from 'mongodb'
import express, {Request, Response} from 'express'
import { connectDB } from './database'
import path from 'path';

const bodyParser = require ('body-parser')
const app = express()
const methodOverride = require('method-override')   //서버에서 PUT DELETE요청위해 methodOverride 사용
const bcrypt = require('bcrypt')
const MongoStore = require('connect-mongo')         //세션을 메모리말고 db에 저장하려면

const { createServer } = require('http')
const { join } = require('path')
const { Server } = require('socket.io')
const server = createServer(app)

const { S3Client } = require('@aws-sdk/client-s3')  // @aws-sdk/client-s3 AWS s3 사용시 필요
const multer = require('multer')                    // multer 유저가 보낸 파일 다루기 쉬워지는 라이브러리
const multerS3 = require('multer-s3')               // multer-s3 s3에 업로드 도와주는 라이브러리
const s3 = new S3Client({                             
  region : 'us-west-1',
  credentials : {
      accessKeyId : process.env.S3_KEY,
      secretAccessKey : process.env.S3_SECRET
  }
})

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'lincolncaforum1',
    key: function (req: any, file: File, cb: Callback, err: Error) {
      cb(err, Date.now().toString()) //업로드시 파일명 변경가능 겹치면 안되기떄문에 현재시간으로 업로드되게함
    }
  })
})

app.use(methodOverride('_method'))                 //여기까지 methodOverride
app.use(express.static(__dirname + '/public'))    //public폴더참조를 위한 세팅
app.set('view engine', 'ejs')                     //ejs 세팅 html에다가 db데이터 꽂아주는 html 템플릿. 근데 확장자가 ejs임 views 폴더안에 넣는게 국룰
app.use(express.json())                           //res.body 쓰려면 이거랑,    body-parser에서 온것들
app.use(express.urlencoded({extended:true}))      //이거 필요

const session = require('express-session')        //로그인 form 만들어주는 라이브러리

import passport from 'passport'              //회원등록기능 라이브러리
const LocalStrategy = require('passport-local')   //회원 로그인기능 라이브러리

const sessionMiddleware = session({secret: process.env.SECRET, resave: false, saveUninitialized: false,})

app.use(sessionMiddleware)
app.use(passport.initialize())                    //app.use끼리 순서 중요..
app.use(session({                                 //login 접속시 로그인페이지 보여주기
  secret: process.env.SECRET,                      //환경변수 중요!!! 세션 document id는 암호화해서 유저에게 보냄 절대 털리면 안됨  !!!중요
  resave : false,                                 //유저가 서버로 요청할때마다 세션 갱신할건지 보통 false가 일반적
  saveUninitialized : false,                      //로그인 안해도 세션 만들건지
  cookie : { maxAge : 60*60*1000},             //ms단위로 로그인세션 기간정함
  store: MongoStore.create({                      //서버가 재시작돼도 세션유지시켜주는 라이브러리 (session을 db에 저장해버림)
    mongoUrl: process.env.DB_URL,                 //환경변수 클라우드에 서버 배포할때 따로 env 파일을 만들어 보관하는게 나음
    dbName: 'forum'
  })
}))

app.use(passport.session())
app.use(bodyParser.json())                //request 본문 파싱위한 bodyparser 미들웨어

// app.use(ask_login) API 100개에 미들웨어 전부 적용하고싶을때 현재 이 줄아래 있는 모든 API에는 현재 ask_login함수의 미들웨어 적용을 받는다
// app.use('/URL', ask_login) 해당 URL에만 해당 함수를 미들웨어로 적용가능하기도 함 /URL 하위 URL 전부에도 적용하기때문에 잘 쓰지않음 

// 혹은 이런식으로 /list API들마다 현재시간을 콘솔로 띄워주는 미들웨어도 만들수있음
// app.use('/list', (req, res, next){
//   console.log(new Date())
// })

let db : Db;
connectDB.then((client)=>{
  console.log('DB연결 성공')
  db = client.db('forum');                   //forum이라는 이름의 Database에 접속 (RDB의 하위개념 Schema와는 어떤관계인지모르나 대충 비슷하다고 생각..)
  server.listen(process.env.PORT, function(){               //포트번호도 환경변수에 속함 .env에서 끌어올땐 process.env.변수명 방식으로 사용
    console.log(`http://localhost:${process.env.PORT} 에서 서버 실행중`);
  });
}).catch((err : Error)=>{
  console.log(err)
})

function ask_login(req : any, res: Response, next: Function){
  if(!req.user) {
    return res.send("<script>alert('로그인하세요'); window.location.replace('/login');</script>")
  }
  next()
}

function ask_logout(req: any, res: Response, next: Function){
  if(req.user) {
    return res.send("<script>alert('로그아웃해주세요'); history.back();</script>")
  }
  next()
}

//Home 접속시
app.get('/', function(req: any, res: Response){
  console.log(req.user)
  res.sendFile(path.join(__dirname, '/index.html'));
})

app.get('/home', (req: any, res: any) => {
  res.render('home.ejs', {signed: req.user?1:0, user:req.user? req.user:0})
})

//home/write 접속시 미들웨어 ask_login 추가 미들웨어 함수는 여러개 들어갈 수 있고, 순서대로 실행 후 마지막 중괄호 안의 내용을 실행한다
app.get('/write', ask_login, (req: any, res: Response) => {
  if(req.session.passport === undefined) res.render('write.ejs', {singed: 0})
  else if(req.session.passport) res.render('write.ejs', {signed: 1, user:req.user?req.user:0})
})

///write 페이지의 HTML에서 name="img1" 이름을 가진 이미지가 들어오면 S3에 자동 업로드해줌
//업로드 완료시 이미지의 URL도 생성해주는데 req.file안에 들어있음
//이미지 여러장 업로드할 경우 HTML input file에서 multiple 속성만 추가할게 아니라 upload.single이 아닌 upload.array로 바꿔야함
app.post('/write/add', ask_login, async(req: any, res: Response)=>{  
  try{                                       //try 안에 코드 실행해보고
    let content = req.body.content
    console.log(`${req.body.title}\n ${req.body.content} \n`)
    console.log(content.substring(content.indexOf('![](') + 4, content.indexOf(')')))

    db.collection('post').insertOne(
      {
        title: req.body.title, 
        content: req.body.content,
        time: new Date(),
        user: req.user._id,
        username: req.user.username
      }
    ) //db insert 문법 post라는 컬렉션(RDB에선 Table)에 접속
    res.json({redirectUrl: '/list/1'});                 //페이지 네비게잇
  } catch (e) {                              //에러났으면 catch 코드 실행해봐
    console.log(e);                          //어떤 이유로 에러가 났는지 확인
    res.status(500).send('서버에러남');
  }
})

//토스터ui editor에서 내용입력할때 이미지 업로드시(AWS에 업로드 먼저) 이미지 미리보기 표시용 post api
app.post('/write/upload', upload.single('file'), (req: any, res: any) => {
  if (req.file) {
    res.json({ url: req.file.location});
  } else {
    res.status(400).send('No file uploaded');
  }
})

//home/list접속시
//코드 스탠다드: mongodb에선 db에서 데이터를 가져온다음 다음 줄의 코드들이 실행되는것을 동기화 시키고 싶을때 async await를 강제함 .then()을 좋아하지않음
app.get('/list', async(req, res) => {
  try{
    let rowCount = await db.collection('post').count()
    let result = await db.collection('post')
    .find().toArray()                     //Collection의 모든 documents를 출력하는 코드. await은 express 정책에 따라 정해진곳에서만 사용가능..
                                          //받아오는 document들은 array 타입으로 받아옴 result[0] 첫번째값, result[1] 두번째값...
    //console.log(result)                 //res.send나 res.sendFile, res.render 요청은 한번만 쓸수있음.. 맨위에것만 실행되고 나머지는 무시됨
    if(result == null || rowCount == 0) {
      res.redirect('/list/1')
    } else {      
      res.render('list.ejs', {글목록: result, 글수: rowCount})    //ejs 파일은 res.render 라고 써야됨 send나 sendFile 안됨
    }
  } catch (e) { 
    console.log(e)
    res.status(404).send('현재 페이지에 게시글 없음')
  }  
})                                                                //view 폴더안에 넣는게 국룰이었기때문에 폴더경로를 /views/list.ejs라고 안해도 됨

app.get('/list/:page', async(req: any, res: Response) => {    //URL 파라미터 이용
  //1~10번글까지 찾아 result 변수에 저장
  try {
    let rowCount = await db.collection('post').count()
    let result = await db.collection('post')
    .find().sort({time: -1}).skip((req.params.page-1) * 10)                           //.find({_id: {$gt: new ObjectId(req.params.page}}) 이런식이면 '다음'버튼밖에 못만듬
    .limit(10).toArray()                                             //.limit(5).toArray()
    
    if(result == null || rowCount == 0) {
      res.send('게시판 글 없음')
    }
    else { //if(req.session.passport === undefined) 
      console.log(req.user)
      res.render('list.ejs', {글목록: result, 글수: rowCount, signed: req.session.passport? 1:0, user: req.user?req.user:0})
      //console.log(req.session.passport)
    }    
  } catch (e) {
    console.log(e)
    res.status(404).send('존재하지 않는 페이지')
  }  
})

app.get('/searchWord/:page', async(req: any, res: Response) => {
  try {
    let searchCon = [
      {$search: {
        index : 'index_title',
        text: { query: req.query.keyword, path: 'title'}
      }},
      {$sort: {time:-1}},
      {$skip: (req.params.page-1)*10}
    ]
    
    let searchConCount = [
      {$search: {
        index : 'index_title',
        text: { query: req.query.keyword, path: 'title'}
      }}]

    let searchedRows = await db
    .collection('post')
    .aggregate(searchConCount).toArray()
    let rowCount = searchedRows.length
    console.log(rowCount)

    let result = await db
    .collection('post')
    .aggregate(searchCon)
    .toArray()
        
    if(rowCount == 0) {
      res.send('검색결과가 없습니다.')
    } else {
      if(req.session.passport === undefined) {
        res.render('searchResult.ejs', {글목록: result, 글수: result.length, signed:0, user:req.user?req.user:0})
        console.log(result)
      } else if(req.session.passport) res.render('searchResult.ejs', {글목록: result, 글수:rowCount, signed:1, keyword:req.query.keyword, user:req.user?req.user:0})
    }
  } catch (e) {
    console.log(e)
    res.status(500).send('뭐 검색하다 오셨어요?')
  }
})

app.get('/detail/:id', async (req: any, res: Response)=>{
  // console.log(req.params);
  try{
    let result = await db.collection('post').findOne({_id : new ObjectId(req.params.id)})
    let comResult = await db.collection('comment').find({parentId: new ObjectId(req.params.id)}).toArray()
    if(result == null) {
      res.status(404).send('db에 없는 데이터')
    }
    else {
      if(req.session.passport === undefined){
        res.render('detail.ejs', {row:result, comment: comResult, signed: 0, user:''})
      } else {
        res.render('detail.ejs', {row:result, comment:comResult, signed: 1, user:req.user?req.user:0})
      }
    }
  }
  catch (e) {
    console.log(e)
    res.status(404).send('존재하지않는 페이지')
  }    
})

app.get('/getContent/:id', async (req: any, res: any) => {
  let result = await db.collection('post').findOne({_id: new ObjectId(req.params.id)})
  res.send({result: result})
})

app.post('/comment', async (req: any, res: Response)=> {
  await db.collection('comment').insertOne({
    user: new ObjectId(req.user._id),
    username: req.user.username,
    content: req.body.content,
    parentId: new ObjectId(req.body.parentId)
  })
  res.redirect('back')
})

app.get('/edit/:id', ask_login, async(req: any, res:Response)=>{
  let result = await db.collection('post').findOne({_id : new ObjectId(req.params.id)})
  if (result != null) {
    let contentHTML = JSON.stringify(result.content).replace(/\n/, "<br>")
    console.log(contentHTML)
    if(req.session.passport === undefined) res.render('edit.ejs', {data:result, content:contentHTML, signed: 0})
    else if(req.session.passport) res.render('edit.ejs', {data:result, content:contentHTML, signed: 1, user:req.user?req.user:0})
  }  
})

app.put('/edit', ask_login, async(req: any, res: Response)=>{//RESTful 포맷에 따라 methodOverride로 POST요청에서 PUT요청으로 바꿈
  try{                                       //try 안에 코드 실행해보고
    await db.collection('post').updateOne(
      {_id: new ObjectId(req.body._id)}, 
      {
        $set: {title: req.body.title, content: req.body.content}
      }
    )
    //db insert 문법 post라는 컬렉션(RDB에선 Table)에 접속
    res.json({redirectUrl: '/list/1'});                 //페이지 네비게잇   
  } catch (e) {                              //에러났으면 catch 코드 실행해봐
    console.log(e);                          //어떤 이유로 에러가 났는지 확인
    res.status(500).send('서버에러남');
  }
})

//토스터ui editor에서 내용입력할때 이미지 업로드시(AWS에 업로드 먼저) 이미지 미리보기 표시용 post api
app.post('/edit/upload', upload.single('file'), (req: any, res: any) => {
  if (req.file) {
    res.json({ url: req.file.location});
  } else {
    res.status(400).send('No file uploaded');
  }
})

app.delete('/delete', async (req: any, res: Response) => {
  await db.collection('post').deleteOne({
    _id : new ObjectId(req.query.docId),
    user: new ObjectId(req.user._id)
  })
  //console.log(req.query.docId)               //Query String으로 작성해서 보내온 데이터이기때문에 req.body나 req.params가 아닌 req.query로 꺼내쓴다
  //res.redirect('list')                      //ajax는 새로고침하지않는 장점인데 이따구로 navigate하면 안됨 어차피 적용 안되거든..
  res.json();                                 //이거 안쓰면 ajax 삭제 바로적용 안됨
})

//상세페이지에서 글 삭제시 delete 요청
app.delete('/deleteOnDetail/post/', async(req, res) => {
  console.log(req.body._id)
  await db.collection('post').deleteOne({_id: new ObjectId(req.body._id)})
  await db.collection('comment').deleteMany({parentId: new ObjectId(req.body._id)})
  res.redirect('/list/1')
})

//상세페이지에서 댓글 삭제시 delete 요청
app.delete('/deleteOnDetail/comment/', ask_login, async (req: any, res) => {
  await db.collection('comment').deleteOne({_id: new ObjectId(req.query.comId)})
  res.json();
})

app.get('/news', (req, res) =>{
  res.send('오늘 비 안옴')
})


//제출한 ID/비번 검사하는 코드 적는곳
passport.use(new LocalStrategy(async (inputUsername: any, inputPassword: any, cb: any) => {
  try{
    let result = await db.collection('user').findOne({ username : inputUsername})
    if (!result) {   //cb(1, 2, 3) 2에 false를 넣으면 로그인에 실패했다고 알려주는거
      return cb(null, false, { message: '가입되지 않은 아이디입니다 가입페이지로 이동합니다' })
    }

    
    if (await bcrypt.compare(inputPassword, result.password)) {     //bcrypt 기능으로 db에 저장된 비번과 유저가 입력한 비번과 비교
      return cb(null, result) //로그인성공시 result를 보여줌
    } else {
      return cb(null, false, { message: '틀린 비밀번호입니다' });
    }
  } catch (e) {
    console.log(e)
    cb.status(503).send('로그인실패')
  }  
}))
//이제 passport.authenticate('local')() 쓰면 위 함수가 실행됨

passport.serializeUser((user: any, done: any) => {
  process.nextTick(() => {                    //내부 코드를 비동기적으로 처리해줌 queueMicroTask()와 비슷하다고함
    done(null, {id: new ObjectId(user._id), username: user.username})      //아래 req.logIn() 할때마다 세션 document에 기록되며 쿠키도 자동으로 만들어줌
  })
})

passport.deserializeUser(async (user: any, done: any) => {    
  let result = await db.collection('user').findOne({_id: new ObjectId(user.id)})  //최신 유저정보를 갱신하기위해 db에서 추가적으로 id 조회 하지만 이렇게되면 비번까지 가져오게됨
  if (result !== null){
    delete result.password                    //비번은 지워놔야함
  }
  process.nextTick(() => {                    //쿠키까보는 역할하는 코드
    done(null, result)                        //쿠키가 이상이 없으면 현재 로그인된 유저정보 알려줌
  })                                          //이제 서버내에서 req.user하면 로그인된 유저정보 알려줌
})

//--------------------------------------------------------------------------------------
//위에서 passport 라이브러리를 이용한 기본적 login 함수세팅을 마치고나서 
//아래부터 login관련 api를 구현한다. 이 순서를 지키지 못하면 로그인 기능이 작동이 안될수도 있음
//---------------------------------------------------------------------------------------

app.get('/login', ask_logout, async (req: any, res: any)=>{
  if(req.session.passport === undefined) res.render('login.ejs', {signed: 0})
    else if(req.session.passport) res.render('login.ejs', {signed: 1})
})

app.post('/login', async (req: any, res: any, next: Function)=>{
  passport.authenticate('local', (error: Error, user: any, info: any)=>{
    if(error) return res.status(500).json(error)          //로그인과정 오류시
    // if(!user) return res.status(401).json(info.message)   //로그인 매칭 실패시 
    if(!user) {
      if(info.message == '가입되지 않은 아이디입니다 가입페이지로 이동합니다') {
        return res.send(`<script>alert('${info.message}'); location.href='/register';</script>`)
      } else if(info.message == '틀린 비밀번호입니다') {
        return res.send(`<script>alert('${info.message}'); history.back();</script>`)
      }
      
    }
    req.logIn(user, (err: Error)=>{                                 //로그인성공시
      if(err) {
        return next(err)
      }
      res.redirect('/home')
    })
  })(req, res, next)  //비교작업 에러시 error에 들어옴, 비교작업이 성공적일때 user에 정보들어옴, ID/PW이 일치하지않는경우엔 info에 정보가 들어감
})

app.post('/logout', ask_login, (req: any, res: any, next: Function) =>{
  req.logout((err: Error) => {
    if (err) return next(err)
    console.log(req.session)
    res.redirect('/')
  })
})

// app.get('/edit/:id', async(req,res)=>{
//   let result = await db.collection('post').findOne({_id : new ObjectId(req.params.id)})
//   res.render('edit.ejs', {data: result})
// })

app.get('/account', ask_login, async (req: any, res: Response) => {
  console.log(req.user)
  if(req.session.passport === undefined) res.render('account.ejs', {data:req.user, signed: 0})
    else if(req.session.passport) res.render('account.ejs', {data:req.user, signed: 1, user:req.user?req.user:0})
})

app.get('/register', ask_logout, async (req: any, res) => {
  if(req.session.passport === undefined) res.render('register.ejs', {signed: 0})
    else if(req.session.passport) res.render('register.ejs', {signed: 1})
})

app.post('/register', async (req: any, res
) => {
  let hashed = await bcrypt.hash(req.body.password, 10)         //hashing 기능 ('문자', 몇번꼬아줄지)
  
  if (await db.collection('user').findOne({username: req.body.username})){
    return res.send("<script>alert('이미 가입된 유저입니다.');"
    + "window.location.replace('/register');</script>")
  } else if (req.body.username == "" || req.body.password == "") {
    return res.send("<script>alert('username과 password는 빈칸으로 쓸 수 없습니다.');" 
    + "window.location.replace('/register');</script>")
  } else {
    await db.collection('user').insertOne({
      username: req.body.username, 
      password: hashed})
    res.redirect('/')
  }  
})

//채팅방 추가
app.get('/addChatRoom', async (req: any, res: Response) => {
  if(req.session.passport) {
    await db.collection('chats').insertOne({
      member: {invitor: new ObjectId(req.user._id), invitor_username: req.user.username, invitee: new ObjectId(req.query.userId), invitee_username: req.query.username},
      date: new Date()
    })
    console.log(req.user._id, req.query.user)
  }
  res.redirect('/chat/list')
})

//채팅방 입장
app.get('/chat/detail/:id', async (req: any, res: any) => {
  if(req.session.passport === undefined) res.render('chatDetail.ejs', {signed:0})
  else if(req.session.passport) {
    let result = await db.collection('chats').findOne({_id: new ObjectId(req.params.id)})
    console.log(req.params.id)
    console.log(result)
    let chatResult = await db.collection('chatMessages').find({parentId: new ObjectId(req.params.id)}).sort({date: 1}).toArray()

    res.render('chatDetail.ejs', {result: result, chatLogs: chatResult, user: req.user?req.user:0, signed:1})
  }
})

//채팅방 리스트 게시판
app.get('/chat/list', ask_login, async(req: any, res: Response) => {//new ObjectId(req.user._id)
  let result = await db.collection('chats').find({$or: [{"member.invitor": new ObjectId(req.user._id)},{"member.invitee": new ObjectId(req.user._id)}]}).sort({date: -1}).toArray()

  let lastChat = new Array

  for (let i = 0; i < result.length; i++){
  lastChat.push(await db.collection('chatMessages').find({parentId: new ObjectId(result[i]._id)}, {limit: 1}).sort({$natural: -1}).toArray())
  }
  //array변수에 push하여 안에 array를 넣기때문에 ejs 파일에서 출력시 좀 못생겨짐, ex. <%=lastChat[i][0].text%> 다른 방법이 있지않을까? toArray방식말고는 없을까?
  //findOne은 sort가 안돼서 마지막걸 가져올수가 없음
  res.render('chats.ejs', {result: result, lastChat: lastChat, signed:1, user:req.user})
})

//채팅방 삭제
app.delete('/deleteChat', async (req: any, res: Response) => {
  await db.collection('chats').deleteOne({
    _id : new ObjectId(req.query.docId)
  })
  await db.collection('chatMessages').deleteMany({
    parentId: new ObjectId(req.query.docId)
  })
  //console.log(req.query.docId)               //Query String으로 작성해서 보내온 데이터이기때문에 req.body나 req.params가 아닌 req.query로 꺼내쓴다
  //res.redirect('list')                      //ajax는 새로고침하지않는 장점인데 이따구로 navigate하면 안됨 어차피 적용 안되거든..
  res.json();                                 //이거 안쓰면 ajax 삭제 바로적용 안됨
})

const io = new Server(server)
const wrap = (middleware: any) => (socket: any, next: Function) => middleware(socket.request, {}, next)
io.use(wrap(sessionMiddleware))
io.use(wrap(passport.initialize()))
io.use(wrap(passport.session()))

io.on('connection', (socket: any) => {
  const socketSession = socket.request.user;
  // console.log(socket.request.user)
  let userId = socket.request.user._id
  // socket.on('age', (data)=> {
  //   console.log('유저가 보낸거:', data)
  //   io.emit('name', 'Oh')                     //서버에서 유저쪽으로 데이터 전송    
  // }) //유저가 소켓으로 보내준 데이터 받아오려면

  socket.on('ask-join', (data: any) => {           //서버가 ask-join 요청을 받을시
    socket.join(data)                         //data 번방으로 조인시켜줌
  })

  socket.on('message-send', async (data: any) => {              //서버는 메세지 수신시 룸에 전달 채팅상세DB 저장
    await db.collection('chatMessages').insertOne({
      text: data.msg,
      parentId: new ObjectId(data.room),
      poster: new ObjectId(data.poster),
      posterUsername: data.posterUsername,
      date: new Date()
    }) //text, data, parentId, poster
    io.to(data.room).emit('message-broadcast', {msg: data.msg, posterId: data.poster} )//data.room에 'message-broadcast'라는 이름으로 data.msg를 뿌려준다
  })
})

//Server-sent Event
app.get('/stream/list', (req, res) => {
  res.writeHead(200, {
    "Connection": "keep-alive",
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
  })

  //document 발행되는 조건
  let condition = [
    { $match: {operationType: 'insert'}}  //{$match: { 'fullDocument.title' : 'nnnn'}} object접근 . 을 찍을때는 따옴표를 해줘야함 (몽고db 사용법)
  ]
  //post collection에 변동사항이 생길때마다 (document 생성/수정/삭제시)
  let changeStream = db.collection('chatMessages').watch()
  changeStream.on('change', (result)=> {  //안의 코드가 실행됨
    if(result.operationType == 'insert') {
      res.write('event: msg\n')
      res.write(`data: ${JSON.stringify(result.fullDocument)}\n\n`)
    }
  })
  //Event는 최소 두개는 써야함  형식은 strict해서 공백위치도 지켜야함
  // setInterval(() => {
  //   res.write('event: msg\n')
  //   res.write('data: {"a" : "b"}\n\n')
  // }, 1000)
})

//너무나도 많아진 api들을 분리해서 보관할때, 먼저 routes폴더를 따로만들고 안에 분류된 js서버파일을 만들고 아래와 같이 import한다
app.use('/shop', require('./routes/shop'))