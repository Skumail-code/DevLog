const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post')
const bcrypt = require('bcryptjs');
const app = express();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const uploadMiddleware = multer({ dest: 'upload' });
const fs = require('fs')

const salt = bcrypt.genSaltSync(10);
const secret = 'cdincepidqded';

app.use(cors({ credentials: true, origin: 'http://localhost:3000' }));
app.use(express.json());
app.use(cookieParser());
app.use('/upload', express.static(__dirname + '/upload'));

mongoose.connect('mongodb+srv://sayyedkumailabbas363:MDIDZk8DGU9341xC@cluster0.xj8vqon.mongodb.net/?retryWrites=true&w=majority');

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userDoc = await User.create({ username, password: bcrypt.hashSync(password, salt), });
        res.json(userDoc);
    } catch (e) {
        console.log(e);
        res.status(400).json(e);
    }

});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try{
    const userDoc = await User.findOne({ username });
    if(!userDoc){
        res.status(400).json('User not found');
        return;
    }

    const passOk = bcrypt.compareSync(password, userDoc.password);
    if (passOk) {

        // logged in
        jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
            if (err) throw err;
            res.cookie('token', token).json({
                id: userDoc._id,
                username,
            });
        });
    } else {
        res.status(400).json('wrong credentials');
    }
}catch (e) {
    console.log(e);
    res.status(400).json('Error')
}
})

app.get('/profile', (req, res) => {
    const { token } = req.cookies;
    jwt.verify(token, secret, {}, (err, info) => {
        if (err) throw err;
        res.json(info);
    });
});

app.post('/logout', (req, res) => {
    res.cookie('token', '').json('ok');
})

app.post('/post', uploadMiddleware.single('file'), async (req, res) => {
    const { originalname, path } = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    const newPath = path + '.' + ext;
    fs.renameSync(path, newPath);

    const { token } = req.cookies;
    jwt.verify(token, secret, {}, async (err, info) => {
        if (err) throw err;
        const { title, summary, content } = req.body;
        const postDoc = await Post.create({
            title,
            summary,
            content,
            cover: newPath,
            author: info.id,
        });
        res.json(postDoc);
    });

});

app.put('/post', uploadMiddleware.single('file'), async (req, res) => {
    let newPath = null;
    if (req.file) {
        const { originalname, path } = req.file;
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        newPath = path + '.' + ext;
        fs.renameSync(path, newPath);
    };

    const {token} = req.cookies;
    jwt.verify(token, secret, {}, async (err, info) => {
        if (err) throw err;
        const { id,title, summary, content } = req.body;
        const postDoc = await Post.findById(id);
        const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
        if (!isAuthor){
            return res.status(400).json('you are not the author')
        }

        await postDoc.updateOne({
            title,
            summary,
            content,
            cover: newPath ? newPath : postDoc.cover,
        });

        res.json(postDoc);
    });
})

// Delete functionality
app.delete('/post/:postId', async (req, res) => {
    const { postId } = req.params;
    const { token } = req.cookies;
    
    jwt.verify(token, secret, {}, async (err, info) => {
      if (err) throw err;
      
      try {
        const postDoc = await Post.findById(postId);
        const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
        
        if (!isAuthor) {
          return res.status(400).json('You are not the author.');
        }
        
        await Post.findByIdAndDelete(postId);
        
        res.json({ message: 'Post deleted successfully.' });
      } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json('An error occurred while deleting the post.');
      }
    });
  });
  

app.get('/post', async (req, res) => {
    res.json(
        await Post.find()
            .populate('author', ['username'])
            .sort({ createdAt: -1 })
            .limit(20)
    );
});

app.get('/posts/:id', async (req, res) => {
    const { id } = req.params;
    const postDoc = await Post.findById(id).populate('author', ['username']);
    res.json(postDoc);
})


app.listen(4000);

