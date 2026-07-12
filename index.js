const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin")
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.zgye7fw.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri);

// index.js
const decoded = Buffer.from(process.env.FIREBASE_SERVICE_KEY, "base64").toString("utf8");
const serviceAccount = JSON.parse(decoded);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const verifyToken = async (req, res, next) => {

    console.log(req.headers.authorization);
    if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unthorized access' })
    }

    const token = req.headers.authorization.split(' ')[1];
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' });
    }

    try {
        const userInfo = await admin.auth().verifyIdToken(token);
        req.token_email = userInfo.email;
        console.log('after token verify', userInfo);
        next()
    }
    catch {
        res.status(401).send({ message: 'unvalid token' });
    }
}

async function run() {
    try {
        await client.connect();
        const smart2DB = client.db("smart-deals-2");
        const smart2DBCollection = smart2DB.collection("users");
        const allProductsCollection = smart2DB.collection("all-products");
        const bidsCollection = smart2DB.collection('bids');

        //get user by login 
        app.get('/users', verifyToken, async (req, res) => {
            const cursor = smart2DBCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })

        app.post('/users', async (req, res) => {
            const newUser = req.body;
            const email = req.body.email;
            const exitingUser = await smart2DBCollection.findOne({ email });
            if (exitingUser) {
                return res.send({
                    message: "email already exits"
                })
            } else {
                const result = await smart2DBCollection.insertOne(newUser);
                res.send(result);
            }
        })

        //all products
        app.get('/all-products', async (req, res) => {
            const cursor = allProductsCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/details/:id', async (req, res) => {
            const id = req.params.id;
            const query = {
                _id: new ObjectId(id)
            }
            const result = await allProductsCollection.findOne(query);
            res.send(result);
        })

        app.post('/all-products', verifyToken, async (req, res) => {
            console.log('after config', req.headers);
            const newProduct = req.body;
            const result = await allProductsCollection.insertOne(newProduct);
            res.send(result);
        })

        //bids
        // app.get('/bids', async (req, res) => {
        //     const cursor = bidsCollection.find()
        //     const result = await cursor.toArray()
        //     res.send(result);
        // })

        app.get('/bids/products/:productId', async (req, res) => {
            const productId = req.params.productId;
            const query = {
                productId: productId
            };
            const cursor = bidsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/bids', verifyToken, async (req, res) => {
            const email = req.query.email;
            console.log(email);
            const query = {};
            if (email) {
                if (email !== req.token_email) {
                    return res.status(403).send({ message: 'forbiden access' })
                }
                query.buyer_email = email
            }
            const cursor = bidsCollection.find(query)
            const result = await cursor.toArray();
            res.send(result);
        })

        app.post('/bids', async (req, res) => {
            const newBids = req.body;
            const result = await bidsCollection.insertOne(newBids);
            res.send(result);
        })


    } catch (err) {
        console.log(err);
    }
}

run().catch(err => console.log(err));

app.get('/', async (req, res) => {
    res.send('server connected!');
})

app.listen(port, (req, res) => {
    console.log(`server running on port: ${port}`);
})