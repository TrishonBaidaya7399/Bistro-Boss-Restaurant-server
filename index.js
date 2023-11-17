const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

//middlewares
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.abac1va.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const userCollection = client.db("BistroDB").collection("users");
    const menuCollection = client.db("BistroDB").collection("menu");
    const reviewCollection = client.db("BistroDB").collection("reviews");
    const cartCollection = client.db("BistroDB").collection("cartItems");

    // <---------------- JWT token ---------------->
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1hr",
      });
      res.send({token})
    });

    // <---------------- Users ---------------->
    //set User data
    app.post("/users", async (req, res) => {
      const user = req.body;
      /** insert email if user doesn't exists
       * we can do this in many ways
       * 1. by making email unique
       * 2. upsert
       * 3. simple checking
       */
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists!", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    //middleware to verify access token
    const verifyToken = (req, res, next)=>{
      console.log("inside verify token: ",req.headers.authorization);
      if(!req.headers.authorization){
        return res.status(401).send({message: "Forbidden access!"})
      }
      const token = req.headers.authorization.split(" ")[1]
      console.log(token);
      if(!token){
        return res.status(401).send({message: "Unauthorized access!"})
      }
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded)=>{
        if(error){
          return res.status(401).send({message: "Unauthorized access!"})
        }
        req.decoded = decoded;
        next()
      })
    }

    // use verify admin after verify token
    const verifyAdmin = async(req, res, next)=>{
      const email = req.decoded.email;
      const query = {email: email}
      const user = await userCollection.findOne(query)
      const isAdmin = user?.role === "admin";
      if(!isAdmin){
        return res.status(403).send({message: "forbidden access"})
      }
      next();
    }


    app.get("/users/admin/:email", verifyToken, async(req, res)=>{
      const email= req.params.email;
      if(email !== req.decoded.email){
        return res.status(403).send({message: "Forbidden access!"}) 
      }
      const query = {email: email}
      const user = await userCollection.findOne(query);
      let admin = false;
      if(user){
        admin = user?.role === "admin"
      } 
      res.send({admin})
    })



    app.get("/users",verifyToken, verifyAdmin, async (req, res) => {
      console.log(req.headers);
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // make an admin
    app.patch("/users/admin/:id",verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // <---------------- Menu ---------------->
    //get all menu
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    // <---------------- Review ---------------->
    //get all menu
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    //<---------------- Cart ---------------->
    app.post("/cart", async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    app.get("/cart", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/cart/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Restaurant is Open now!");
});
app.listen(port, () => {
  console.log(`Bistro Boss is sitting on port`, port);
});
