const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://flutter:flutter@clusterluiz.yzscwl0.mongodb.net/?retryWrites=true&w=majority&appName=ClusterLuiz";
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        console.log("Connected successfully to MongoDB");
    } catch (err) {
        console.error('Failed to connect to MongoDB:', err);
    } finally {
        await client.close();
    }
}

run();
