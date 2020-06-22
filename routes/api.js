/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

var expect = require('chai').expect;
var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectId;

module.exports = function (app) {
  MongoClient.connect(process.env.DB, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.log(err);
      return;
    }
    const db = client.db('test');
    db.collection('threads').drop().catch(err => console.log('nothing to delete'));
    seedDB();
    console.log('db connected');

    app.route('/api/threads/:board')
      .get(async (req, res) => {
        // get 10 most recent bumped threads, minus reported & delete_password
        let threads = await getThreads();
        //console.log(threads);
        res.json(threads);
      })
      .post(async (req, res) => {
        // verify received text and delete_password
        let text = req.body.text;
        let pass = req.body.delete_password;
        let board = req.body.board;
        if (!text || !pass || !board) return res.send('missing required fields');
        let result = await createThread(text, pass).catch((err) => res.send('error creating thread'));
        res.redirect(`/b/${board}`);
      })
      .put(async (req, res) => {
        let threadID = req.body.thread_id;
        let pass = req.body.delete_password;
        if (!threadID || !pass) return res.send('missing required fields');
        let thread = await getFullThread(threadID);

        if (thread && thread.delete_password === pass) {
          let attempt = await reportThread(threadID);
          if (attempt.value.reported) return res.send('success');
        }
        return res.send('incorrect password');
      })
      .delete(async (req, res) => {
        let threadID = req.body.thread_id;
        let pass = req.body.delete_password;
        if (!threadID || !pass) return res.send('missing required fields');
        let thread = await getFullThread(threadID);
        if (thread && thread.delete_password === pass) {
          let attempt = await deleteThread(threadID);
          if (attempt.value) return res.send('success');
        }
        return res.send('incorrect password');
      });

    app.route('/api/replies/:board')
      .get(async (req, res) => {
        if (req.query.thread_id) {
          let thread = await getThread(req.query.thread_id);
          if (thread && thread.replies) {
            return res.json(thread);
          }
          //console.log(thread);
        }
        return res.send('missing thread_id');
      })
      .post(async (req, res) => {
        // verify received text, thread_id, and delete_password
        let text = req.body.text;
        let pass = req.body.delete_password;
        let threadID = req.body.thread_id;
        let board = req.body.board;
        if (!text || !pass || !threadID || !board) return res.send('missing required fields');
        // create reply on thread
        let reply = await createReply(threadID, text, pass);
        if (reply.value) {
          return res.redirect(`/b/${board}/${threadID}`)
        }
        return res.send('failed to create reply')
      })
      .put(async (req, res) => {
        let threadID = req.body.thread_id;
        let replyID = req.body.reply_id;
        let pass = req.body.delete_password;
        if (!threadID || !replyID || !pass) return res.send('missing required fields');
        let thread = await getReplies(threadID, replyID);
        let reply = thread.replies.filter(item => item._id == replyID)[0];
        if (reply && reply.delete_password === pass) {
          let attempt = await reportReply(threadID, replyID);
          if (attempt.value.reported) return res.send('success');
        }
        return res.send('incorrect password');
      })
      .delete(async (req, res) => {
        let threadID = req.body.thread_id;
        let replyID = req.body.reply_id;
        let pass = req.body.delete_password;
        if (!threadID || !replyID || !pass) return res.send('missing required fields');
        let thread = await getReplies(threadID, replyID);
        let reply = thread.replies.filter(item => item._id == replyID)[0];
        if (reply && reply.delete_password === pass) {
          let attempt = await deleteReply(threadID, replyID);
          //console.log(attempt.value.replies);
          if (attempt.value) {
            reply = attempt.value.replies.filter(item => item._id == replyID)[0];
            //console.log(reply)
            if(reply.text == '[deleted]') return res.send('success');
          }
        }
        return res.send('incorrect password');
      });

    function createThread(text, password) {
      let date = new Date();
      return db.collection('threads').insertOne({ text: text, bumped_on: date, created_on: date, delete_password: password, replies: [], reported: false });
    }
    function createReply(id, text, password) {
      let date = new Date();
      return db.collection('threads').findOneAndUpdate({ _id: ObjectId(id) }, { $set: { bumped_on: date }, $push: { replies: { _id: ObjectId(), text: text, delete_password: password, created_on: date, reported: false } } }, { returnOriginal: false })
    }
    function getThreads() {
      return db.collection('threads')
        .find({}, { replies: { $sort: { created_on: -1 }} })
        .sort({ bumped_on: -1 })
        .limit(10)
        .project({ delete_password: 0, reported: 0, "replies.delete_password": 0, "replies.reported": 0, replies: { $slice: [0, 3] } })
        .toArray();
    }
    function reportThread(id) {
      return db.collection('threads').findOneAndUpdate({ _id: ObjectId(id) }, { $set: { reported: true } }, { returnOriginal: false });
    }
    function reportReply(thread_id, reply_id){
      return db.collection('threads').findOneAndUpdate({_id: ObjectId(thread_id), "replies._id": ObjectId(reply_id)}, { $set: {reported: true}});
    }
    function deleteThread(id) {
      return db.collection('threads').findOneAndDelete({ _id: ObjectId(id) });
    }
    function deleteReply(id, reply_id) {
      return db.collection('threads').findOneAndUpdate({ _id: ObjectId(id), "replies._id": ObjectId(reply_id) }, { $set: { "replies.$.text": '[deleted]'} }, { returnOriginal: false })
    }
    function getThread(id) {
      return db.collection('threads')
      .findOne({_id: ObjectId(id)}, {projection: {delete_password: 0, reported: 0, "replies.delete_password": 0, "replies.reported": 0}});
    }
    function getFullThread(id){
      return db.collection('threads').findOne({ _id: ObjectId(id)});
    }
    function getReplies(thread_id, reply_id){
      return db.collection('threads').findOne({ _id: ObjectId(thread_id)}, { projection: {replies: 1}});
    }

    async function seedDB() {
      await createThread('hello!', 'pass');
      await createThread('hello again', 'pass');
      await createThread('go away', 'pass');
      let threads = await getThreads();
      let threadID = threads[0]._id;
      await createReply(threadID, 'that reply', 'no');
      await createReply(threadID, 'that next reply', 'no');
      await createReply(threadID, 'that last reply', 'no');
    }

  })
};