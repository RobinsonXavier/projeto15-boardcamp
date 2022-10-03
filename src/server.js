import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
    path: path.resolve(__dirname, '../.env')
});

const {Pool} = pg;

const connection = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const app = express();

app.use(cors());
app.use(express.json());

app.get('/categories', (req, res) => {
    const { name } = req.body;

    connection.query('SELECT * FROM categories;').then(response => {
        res.status(200).send(response.rows)
    });
});

app.post('/categories', async (req, res) => {
    const { name } = req.body;

    if(!name) {
        return res.sendStatus(400);
    }

    const list = await connection.query('SELECT * FROM categories;');

    const isTheSame = list.rows.find(element => name === element.name)

    if(isTheSame) {
        return res.sendStatus(409);
    }

    connection.query('INSERT INTO categories (name) VALUES ($1);', [name]).then(response => {
        res.sendStatus(201);
    });
});

app.listen(4000, ()=> {
    console.log("Server Online")
});
