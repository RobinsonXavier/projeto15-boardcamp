import express from 'express';
import cors from 'cors';
import pg from 'pg';
import joi from 'joi';
import dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
    path: path.resolve(__dirname, '../.env')
});

const gamesSchema = joi.object({
    name: joi.string().required(),
    image: joi.string(),
    stockTotal: joi.number().required().min(1),
    pricePerDay: joi.number().required().min(1),
    categoryId: joi.number().required()
});

const {Pool} = pg;

const connection = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const app = express();

app.use(cors());
app.use(express.json());

app.get('/categories', (req, res) => {

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

app.get('/games', (req, res) => {
    const { name } = req.query;

    if(name) {
        connection.query(`SELECT games.*, categories.name as "categoryName" FROM games JOIN categories ON games."categoryId" = categories.id WHERE LOWER(SUBSTRING(games.name, 1, ${name.length})) = $1;`,[name.toLowerCase()]).then(response => {
            return res.status(200).send(response.rows);
        });
    }

    connection.query(`SELECT games.*, categories.name as "categoryName" FROM games JOIN categories ON games."categoryId" = categories.id;`).then(response => {
        res.status(200).send(response.rows)
    });
});

app.post('/games', async (req, res) => {
    const {name, image, stockTotal, categoryId, pricePerDay} = req.body;

    const validation = gamesSchema.validate(req.body, {abortEarly: false});

    if (validation.error) {
        const errors = validation.error.details.map (detail => detail.message);
        return res.status(400).send(errors); 
    }

    const categories = await connection.query('SELECT * FROM categories;');

    const haveId = categories.rows.find(element => {
        return element.id === categoryId
    });

    if(!haveId) {
        return res.sendStatus(400);
    }

    const getGames = await connection.query('SELECT * FROM games;');

    const sameName = getGames.rows.find(element => {
        return element.name === name;
    });

    if (sameName) {
        return res.sendStatus(409);
    }

    connection.query(`INSERT INTO games (name, image, "stockTotal", "categoryId", "pricePerDay") VALUES ($1, $2, $3, $4, $5);`, [ name, image, stockTotal, categoryId, pricePerDay]).then(response => {
        res.sendStatus(201);
    });
});

app.listen(4000, ()=> {
    console.log("Server Online")
});
