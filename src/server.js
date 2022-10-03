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

const customersSchema = joi.object({
    name: joi.string().required(),
    phone: joi.string().min(10).max(11).pattern(/^[0-9]+$/).required(),
    cpf: joi.string().length(11).pattern(/^[0-9]+$/).required(),
    birthday: joi.date().greater('1-1-1922').less('1-1-2010').required()
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

app.get('/customers', (req, res) => {
    const {cpf} = req.query;

    if(cpf) {
        connection.query(`SELECT * FROM customers WHERE SUBSTRING(customers.cpf, 1, ${cpf.length}) = $1;`,[cpf]).then(response => {
            return res.status(200).send(response.rows);
        });
    }

    connection.query('SELECT * FROM customers;').then(response => {
        res.send(response.rows);
    })
});

app.get('/customers/:id', async (req, res) => {
    const {id} = req.params;

    const sameId = await connection.query(`SELECT * FROM customers WHERE id = $1;`, [id]);

    if(!sameId.rows[0]) {
        return res.sendStatus(404);
    }

    connection.query('SELECT * FROM customers WHERE id = $1;', [id]).then(response => {
        res.send(response.rows[0]);
    });

});

app.post('/customers', async (req, res) => {
    const {name, phone, cpf, birthday} = req.body;

    const validation = customersSchema.validate(req.body, {abortEarly: false});

    if(validation.error) {
        const errors = validation.error.details.map (detail => detail.message);
        return res.status(400).send(errors); 
    }
    const sameCpf = await connection.query(`SELECT * FROM customers WHERE cpf = $1;`, [cpf]);

    if (sameCpf.rows[0]) {
        return res.sendStatus(409);
    }

    connection.query(`INSERT INTO customers (name, phone, cpf, birthday) VALUES ($1, $2, $3, $4)`, [name, phone, cpf, birthday]).then( response => {
        res.sendStatus(201);
    });
});

app.put('/customers/:id', async (req, res) => {
    const {id} = req.params;
    const {name, phone, cpf, birthday} = req.body;

    const validation = customersSchema.validate(req.body, {abortEarly: false});

    if(validation.error) {
        const errors = validation.error.details.map (detail => detail.message);
        return res.status(400).send(errors); 
    }

    const sameCpf = await connection.query(`SELECT * FROM customers WHERE cpf = $1;`, [cpf]);

    if (sameCpf.rows[0].id !== Number(id)) {
        return res.sendStatus(409);
    }

    connection.query(`UPDATE customers SET name = $1, phone = $2, cpf = $3, birthday = $4 WHERE id = $5`,[name, phone, cpf, birthday, id]).then(response => {
        res.sendStatus(200);
    });
    
});

app.get('/rentals', (req, res) => {
    const {customerId} = req.query;
    const {gameId} = req.query;

    if (customerId) {
        connection.query('SELECT rentals.*, customers.id as "customerId2", customers.name as "customerName", games.id as "gameId", games.name as "gameName", games."categoryId", categories.name as "categoryName" FROM rentals JOIN customers ON rentals."customerId" = customers.id JOIN games ON rentals."gameId" = games.id JOIN categories ON games."categoryId" = categories.id;').then(response => {
            const list = response.rows.map(element => {
                const obj = {
                    id: element.id,
                    customerId: element.customerId,
                    gameId: element.gameId,
                    rentDate: element.rentDate,
                    daysRented: element.daysRented,
                    returnDate: element.returnDate,
                    originalPrice: element.originalPrice,
                    delayFee: element.delayFee,
                    customer: {
                        id: element.customerId2,
                        name: element.customerName
                    },
                    game : {
                        id: element.gameId,
                        name: element.gameName,
                        categoryId: element.categoryId,
                        categoryName: element.categoryName
                    }
                }
                return obj;
            });
            res.status(200).send(list.filter(element => element.customerId === Number(customerId)))
        });
        
    }

    if (gameId) {
        connection.query('SELECT rentals.*, customers.id as "customerId2", customers.name as "customerName", games.id as "gameId", games.name as "gameName", games."categoryId", categories.name as "categoryName" FROM rentals JOIN customers ON rentals."customerId" = customers.id JOIN games ON rentals."gameId" = games.id JOIN categories ON games."categoryId" = categories.id;').then(response => {
            const list = response.rows.map(element => {
                const obj = {
                    id: element.id,
                    customerId: element.customerId,
                    gameId: element.gameId,
                    rentDate: element.rentDate,
                    daysRented: element.daysRented,
                    returnDate: element.returnDate,
                    originalPrice: element.originalPrice,
                    delayFee: element.delayFee,
                    customer: {
                        id: element.customerId2,
                        name: element.customerName
                    },
                    game : {
                        id: element.gameId,
                        name: element.gameName,
                        categoryId: element.categoryId,
                        categoryName: element.categoryName
                    }
                }
                return obj;
            });
            res.status(200).send(list.filter(element => element.gameId === Number(gameId)))
        });
        
    }

    connection.query('SELECT rentals.*, customers.id as "customerId2", customers.name as "customerName", games.id as "gameId", games.name as "gameName", games."categoryId", categories.name as "categoryName" FROM rentals JOIN customers ON rentals."customerId" = customers.id JOIN games ON rentals."gameId" = games.id JOIN categories ON games."categoryId" = categories.id;').then(response => {
        const list = response.rows;
        res.status(200).send(list.map(element => {
            const obj = {
                id: element.id,
                customerId: element.customerId,
                gameId: element.gameId,
                rentDate: element.rentDate,
                daysRented: element.daysRented,
                returnDate: element.returnDate,
                originalPrice: element.originalPrice,
                delayFee: element.delayFee,
                customer: {
                    id: element.customerId2,
                    name: element.customerName
                },
                game : {
                    id: element.gameId,
                    name: element.gameName,
                    categoryId: element.categoryId,
                    categoryName: element.categoryName
                }
            }
            return obj;
        }))
    });
});

app.post('/rentals', async (req, res) => {
    const {customerId, gameId, daysRented} = req.body;
    const newDate = getDate();
    function getDate() {
        const dateObj = new Date();
        const days = dateObj.getDate();
        const month = dateObj.getUTCMonth() + 1;
        const year = dateObj.getUTCFullYear();

        return year + '-' + month + '-' + days;
    }

    const haveIdCostumers = await connection.query(`SELECT * FROM customers WHERE id = $1`, [Number(customerId)])

    if (!haveIdCostumers.rows[0]) {
        return res.sendStatus(400);
    }

    const haveIdGames = await connection.query(`SELECT * FROM games WHERE id = $1`, [Number(gameId)])

    const allRentals = await connection.query(`SELECT * FROM rentals;`)

    const filteredGameRentals = allRentals.rows.filter(element => element.gameId === Number(gameId));

    if (!haveIdGames.rows[0] || haveIdGames.rows[0].stockTotal <= filteredGameRentals.length) {
        return res.sendStatus(400);
    }

    const getGame = await connection.query(`SELECT * FROM games WHERE id = $1`, [gameId]);
    
    const originalPrice = daysRented * getGame.rows[0].pricePerDay;

    connection.query(`INSERT INTO rentals ("customerId", "gameId", "daysRented", "rentDate", "originalPrice", "returnDate", "delayFee") VALUES ($1, $2, $3, $4, $5, $6, $7);`, [customerId, gameId, daysRented, newDate.toString(), originalPrice, null, null]).then(response => {
        res.sendStatus(201)
    });
    
});

app.post('/rentals/:id/return', async (req, res) => {
    const {id} = req.params;
    const newDate = getDate();

    function getDate() {
        const dateObj = new Date();
        const days = dateObj.getDate();
        const month = dateObj.getUTCMonth() + 1;
        const year = dateObj.getUTCFullYear();

        return year + '-' + month + '-' + days;
    }

    const rental = await connection.query(`SELECT * FROM rentals WHERE id = $1`, [id]);

    const game = await connection.query(`SELECT * FROM games WHERE id = $1`, [rental.rows[0].gameId]);

    if (!rental.rows[0]) {
        return res.sendStatus(404);
    }

    if (rental.rows[0].returnDate) {
        return res.sendStatus(400);
    }

    const calc = Number(newDate.substring(8)) - Number(rental.rows[0].rentDate.toString().substring(8, 11));

    connection.query(`UPDATE rentals SET "returnDate" = $1, "delayFee" = $2 WHERE id = $3`, [newDate.toString(), calc, id]).then(response => {
        res.sendStatus(200);
    });


});

app.delete('/rentals/:id', async (req, res) => {
    const {id} = req.params;

    const rental = await connection.query(`SELECT * FROM rentals WHERE id = $1`, [id]);

    if (!rental.rows[0]) {
        return res.sendStatus(404);
    }

    if (!rental.rows[0].returnDate) {
        return res.sendStatus(400);
    }

    connection.query(`DELETE FROM rentals WHERE id = $1`, [id]).then( response => {
        res.sendStatus(200);
    })
});

app.listen(4000, ()=> {
    console.log("Server Online")
});
