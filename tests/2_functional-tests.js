/*
*
*
*       FILL IN EACH FUNCTIONAL TEST BELOW COMPLETELY
*       -----[Keep the tests in the same order!]-----
*       (if additional are added, keep them at the very end!)
*/

var chaiHttp = require('chai-http');
var chai = require('chai');
var assert = chai.assert;
var server = require('../server');

var threadID, secondThreadID;
var replyID;

chai.use(chaiHttp);

suite('Functional Tests', function () {

  suite('API ROUTING FOR /api/threads/:board', function () {

    suite('POST', function () {
      test('POST new thread on random board', function (done) {
        chai.request(server)
          .post('/api/threads/random')
          .send({ board: 'random', text: 'hello world', delete_password: 'abc123' })
          .end(function (err, res) {
            assert.equal(res.status, 200);
            assert.isArray(res.redirects);
            assert.include(res.redirects[0], '/b/random');
            done();
          });
      });

      test('POST new thread missing inputs', function (done) {
        chai.request(server)
          .post('/api/threads/random')
          .send({ text: 'hello world' })
          .end(function (err, res) {
            assert.equal(res.status, 200);
            assert.equal(res.text, 'missing required fields');
            assert.isArray(res.redirects);
            assert.isUndefined(res.redirects[0]);
            done();
          });
      });
    });

    suite('GET', function () {
      test('GET recent threads', function (done) {
        chai.request(server)
          .get('/api/threads/random')
          .end(function (err, res) {
            //console.log(res.body)
            assert.equal(res.status, 200);
            assert.isArray(res.body);
            assert.equal(res.body[1].replies.length, 3); // seeded data so has 4 replies, should omit last one
            assert.property(res.body[0], 'replies');
            assert.property(res.body[0], 'bumped_on');
            assert.property(res.body[0], 'created_on');
            assert.property(res.body[0], 'text');
            assert.notProperty(res.body[0], 'delete_password');
            assert.notProperty(res.body[0], 'reported');
            threadID = res.body[0]._id;
            secondThreadID = res.body[1]._id;
            done();
          });
      });
    });

    suite('DELETE', function () {
      test('DELETE a thread unsuccessfully with invalid id', function (done) {
        chai.request(server)
          .delete('/api/threads/random')
          .send({ thread_id: 100000000000, delete_password: 'abc123' })
          .end(function (err, res) {
            assert.equal(res.status, 200);
            assert.equal(res.text, 'incorrect password');
            done();
          });
      });
      test('DELETE a thread unsuccessfully with invalid pass', function (done) {
        chai.request(server)
          .delete('/api/threads/random')
          .send({ thread_id: threadID, delete_password: 'abc' })
          .end(function (err, res) {
            assert.equal(res.status, 200);
            assert.equal(res.text, 'incorrect password');
            done();
          });
      });
      test('DELETE a thread successfully', function (done) {
        chai.request(server)
          .delete('/api/threads/random')
          .send({ thread_id: threadID, delete_password: 'abc123' })
          .end(function (err, res) {
            assert.equal(res.status, 200);
            assert.equal(res.text, 'success');
            done();
          });
      });
    });

    suite('PUT', function () {
      test('PUT report a thread successfully', function (done) {
        chai.request(server)
          .put('/api/threads/random')
          .send({ thread_id: secondThreadID, delete_password: 'pass' })
          .end(function (err, res) {
            assert.equal(res.status, 200);
            assert.equal(res.text, 'success');
            done();
          });
      });
      test('PUT report a thread unsuccessfully', function (done) {
        chai.request(server)
          .put('/api/threads/random')
          .send({ thread_id: secondThreadID, delete_password: 'in' })
          .end(function (err, res) {
            assert.equal(res.status, 200);
            assert.equal(res.text, 'incorrect password');
            done();
          });
      });
    });


  });

  suite('API ROUTING FOR /api/replies/:board', function () {

    suite('POST', function () {
      test('POST reply for specific thread', function (done) {
        chai.request(server)
          .post('/api/replies/random')
          .send({ thread_id: secondThreadID, text: 'okay', delete_password: 'pass', board: 'random' })
          .end(function (err, res) {
            assert.equal(res.status, 200);
            assert.isArray(res.redirects);
            assert.include(res.redirects[0], '/b/random/' + secondThreadID)
            done();
          });
      });
      test('POST reply unsuccessfully due to missing fields', function (done) {
        chai.request(server)
          .post('/api/replies/random')
          .send({ text: 'okay', delete_password: 'pass', board: 'random' })
          .end(function (err, res) {
            assert.equal(res.status, 200);
            assert.equal(res.text, 'missing required fields');
            done();
          });
      });
    });

    suite('GET', function () {
      test('GET replies for specific thread', function (done) {
        chai.request(server)
         .get('/api/replies/random')
         .query({thread_id: secondThreadID})
         .end(function(err, res){
           assert.equal(res.status, 200);
           assert.property(res.body, 'replies');
           assert.property(res.body, 'bumped_on');
           assert.property(res.body, 'created_on');
           assert.property(res.body, 'text');
           assert.isArray(res.body.replies);
           assert.property(res.body.replies[0], 'created_on');
           assert.property(res.body.replies[0], 'text');
           assert.notProperty(res.body, 'delete_password');
           assert.notProperty(res.body, 'reported');
           assert.notProperty(res.body.replies[0], 'delete_password');
           assert.notProperty(res.body.replies[0], 'reported');
           replyID = res.body.replies[0]._id;
           done();
         });
      });
    });

    suite('PUT', function () {
      test('PUT report reply successfully', function (done) {
        chai.request(server)
          .put('/api/replies/random')
          .send({ thread_id: secondThreadID, reply_id: replyID, delete_password: 'no' })
          .end(function (err, res) {
            assert.equal(res.status, 200);
            assert.equal(res.text, 'success');
            done();
          });
      });
      test('PUT report reply unsuccessfully due to wrong pass', function (done) {
        chai.request(server)
          .put('/api/replies/random')
          .send({ thread_id: secondThreadID, reply_id: replyID, delete_password: 'nah' })
          .end(function (err, res) {
            assert.equal(res.status, 200);
            assert.equal(res.text, 'incorrect password');
            done();
          });
      });
    });

    suite('DELETE', function () {
      test('DELETE a reply unsuccessfully', function (done) {
        chai.request(server)
          .delete('/api/replies/random')
          .send({ thread_id: secondThreadID, reply_id: replyID, delete_password: 'not right' })
          .end(function (err, res) {
            assert.equal(res.status, 200);
            assert.equal(res.text, 'incorrect password');
            done();
          });
      });
      test('DELETE a reply successfully', function (done) {
        chai.request(server)
          .delete('/api/replies/random')
          .send({ thread_id: secondThreadID, reply_id: replyID, delete_password: 'no' })
          .end(function (err, res) {
            assert.equal(res.status, 200);
            assert.equal(res.text, 'success');
            done();
          });
      });
    });
    
  });

});
