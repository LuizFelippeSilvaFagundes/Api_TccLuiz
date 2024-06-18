const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = 4000;

app.use(bodyParser.json());
app.use(cors());

// URI de conexão ao MongoDB
const uri = "mongodb+srv://luizfelippefagundes06:MgVAPaI2aZSVNptu@clusterattentiveastrona.1jc9v76.mongodb.net/";

// Nome do banco de dados
const dbName = 'DataAttentiveAstronaut';

// Nome das coleções
const userCollectionName = 'usuario';
const psychologistCollectionName = 'psicologo';
const recordCollectionName = 'recordes';
const statisticsCollectionName = 'estatistica'; // Adicionando a coleção de estatísticas

async function getDocuments(collectionName, query = {}) {
    const { email, password } = query;
    delete query.password; // Remover a senha da consulta para evitar que seja enviada para o banco de dados
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);
        const documents = await collection.find(query).toArray();
        console.log(`Fetched documents from ${collectionName}:`, documents); // Log dos documentos buscados
        if (documents.length > 0) {
            // Verificar se a senha corresponde
            const user = documents[0];
            if (user.password === password) {
                return documents;
            } else {
                return []; // Senha incorreta
            }
        } else {
            return [];
        }
    } finally {
        await client.close();
    }
}

// Função para inserir um documento genérico
async function insertDocument(collectionName, document) {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);
        const result = await collection.insertOne(document);
        console.log(`Inserted document into ${collectionName}:`, result); // Log do resultado da inserção
        return result;
    } finally {
        await client.close();
    }
}

// Endpoint para registrar usuário
app.post('/register_user', async (req, res) => {
    const { email, username, password, psychologistEmail } = req.body;
    console.log('Registering user:', { email, username, password, psychologistEmail }); // Log dos dados recebidos
    try {
        const result = await insertDocument(userCollectionName, { email, username, password, psychologistEmail });
        res.status(201).json({ message: 'Usuário registrado com sucesso', _id: result.insertedId });
    } catch (err) {
        console.error('Erro ao registrar usuário:', err); // Log do erro
        res.status(500).json({ error: 'Erro ao registrar usuário' });
    }
});

// Endpoint para registrar psicólogo
app.post('/register_psychologist', async (req, res) => {
    const { email, password } = req.body;
    console.log('Registering psychologist:', { email, password }); // Log dos dados recebidos
    try {
        const result = await insertDocument(psychologistCollectionName, { email, password, usuarios_atrelados: [] });
        res.status(201).json({ message: 'Psicólogo registrado com sucesso' });
    } catch (err) {
        console.error('Erro ao registrar psicólogo:', err); // Log do erro
        res.status(500).json({ error: 'Erro ao registrar psicólogo' });
    }
});

app.post('/login_user', async (req, res) => {
    const { email, password } = req.body;
    console.log('Logging in user:', { email, password }); // Log dos dados recebidos
    try {
        const users = await getDocuments(userCollectionName, { email, password });
        if (users.length > 0) {
            const user = users[0];
            res.status(200).json({ message: 'Login bem-sucedido', _id: user._id, username: user.username });
        } else {
            res.status(401).json({ error: 'Credenciais inválidas' });
        }
    } catch (err) {
        console.error('Erro ao validar login de usuário:', err); // Log do erro
        res.status(500).json({ error: 'Erro ao validar login de usuário' });
    }
});

// Endpoint para validar login de psicólogo
app.post('/login_psychologist', async (req, res) => {
    const { email, password } = req.body;
    console.log('Logging in psychologist:', { email, password }); // Log dos dados recebidos
    try {
        const psychologists = await getDocuments(psychologistCollectionName, { email, password });
        if (psychologists.length > 0) {
            res.status(200).json({ message: 'Login bem-sucedido' });
        } else {
            res.status(401).json({ error: 'Credenciais inválidas' });
        }
    } catch (err) {
        console.error('Erro ao validar login de psicólogo:', err); // Log do erro
        res.status(500).json({ error: 'Erro ao validar login de psicólogo' });
    }
});

// Endpoint para obter psicólogos disponíveis
app.get('/available_psychologists', async (req, res) => {
    console.log('Fetching available psychologists'); // Log da ação
    try {
        const psychologists = await getDocuments(psychologistCollectionName);
        const availablePsychologists = psychologists.filter(p => p.usuarios_atrelados.length === 0);
        res.status(200).json(availablePsychologists);
    } catch (err) {
        console.error('Erro ao obter psicólogos disponíveis:', err); // Log do erro
        res.status(500).json({ error: 'Erro ao obter psicólogos disponíveis' });
    }
});

// Endpoint para atribuir usuário a psicólogo
app.post('/assign_user_to_psychologist', async (req, res) => {
    const { emailUsuario, emailPsicologo } = req.body;
    console.log('Assigning user to psychologist:', { emailUsuario, emailPsicologo }); // Log dos dados recebidos
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(dbName);
        const psicologo = await db.collection(psychologistCollectionName).findOne({ email: emailPsicologo });
        const usuario = await db.collection(userCollectionName).findOne({ email: emailUsuario });

        if (psicologo && usuario) {
            await db.collection(psychologistCollectionName).updateOne(
                { email: emailPsicologo },
                { $push: { usuarios_atrelados: usuario.username } }
            );
            res.status(200).json({ message: 'Usuário atribuído ao psicólogo com sucesso' });
        } else {
            res.status(404).json({ error: 'Usuário ou psicólogo não encontrado' });
        }
    } catch (err) {
        console.error('Erro ao atribuir usuário ao psicólogo:', err); // Log do erro
        res.status(500).json({ error: 'Erro ao atribuir usuário ao psicólogo' });
    } finally {
        await client.close();
    }
});

// Endpoint para registrar um recorde
app.post('/add_record', async (req, res) => {
    const { _id_user, tempo, quantidadeToques, level, email } = req.body;
    console.log('Adding record:', { _id_user, tempo, quantidadeToques, level, email });
    // Log dos dados recebidos
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(dbName);
        const userCollection = db.collection(userCollectionName);
        const recordCollection = db.collection(recordCollectionName);

        // Fetch the user document
        const user = await userCollection.findOne({ _id: new ObjectId(_id_user) });

        if (user) {
            // Prepare the new record with the user's email
            const newRecord = {
                _id_user: new ObjectId(_id_user),
                email: user.email, // Incluir o email do usuário aqui
                tempo: tempo,
                quantidadeToques: quantidadeToques
            };

            // Insert the new record into the recordes collection
            const result = await recordCollection.insertOne(newRecord);
            res.status(201).json({ message: 'Recorde registrado com sucesso', insertedId: result.insertedId });
        } else {
            res.status(404).json({ error: 'Usuário não encontrado' });
        }
    } catch (err) {
        console.error('Erro ao registrar recorde:', err); // Log do erro
        res.status(500).json({ error: 'Erro ao registrar recorde' });
    } finally {
        await client.close();
    }
});

app.post('/add_statistics', async (req, res) => {
    const { email, gamesStarted, gamesWon, winRate, winsWithNoMistakes, bestTime, averageTime, bestScore, averageScore, currentWinStreak, bestWinStreak, timeInterval, difficulty } = req.body;
    console.log('Adding statistics:', { email, gamesStarted, gamesWon, winRate, winsWithNoMistakes, bestTime, averageTime, bestScore, averageScore, currentWinStreak, bestWinStreak, timeInterval, difficulty });
    // Log dos dados recebidos
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(dbName);
        const statisticsCollection = db.collection(statisticsCollectionName);

        const newStatistics = {
            email: email,
            gamesStarted: gamesStarted,
            gamesWon: gamesWon,
            winRate: winRate,
            winsWithNoMistakes: winsWithNoMistakes,
            bestTime: bestTime,
            averageTime: averageTime,
            bestScore: bestScore,
            averageScore: averageScore,
            currentWinStreak: currentWinStreak,
            bestWinStreak: bestWinStreak,
            timeInterval: timeInterval,
            difficulty: difficulty,
        };

        console.log(`Inserting document into ${statisticsCollectionName}:`, newStatistics); // Log do documento antes de inserir
        const result = await statisticsCollection.insertOne(newStatistics);
        console.log(`Inserted document into ${statisticsCollectionName}:`, result); // Log do resultado da inserção
        res.status(201).json({ message: 'Estatísticas registradas com sucesso', insertedId: result.insertedId });
    } catch (err) {
        console.error('Erro ao registrar estatísticas:', err); // Log do erro
        res.status(500).json({ error: 'Erro ao registrar estatísticas' });
    } finally {
        await client.close();
    }
});


// Endpoint para obter recordes de um usuário
app.get('/user_records/:id', async (req, res) => {
    const { id } = req.params;
    console.log('Fetching records for user:', id); // Log do ID do usuário
    try {
        const records = await getDocuments(recordCollectionName, { _id_user: new ObjectId(id) });
        res.status(200).json(records);
    } catch (err) {
        console.error('Erro ao obter recordes do usuário:', err); // Log do erro
        res.status(500).json({ error: 'Erro ao obter recordes do usuário' });
    }
});

app.get('/psychologist_user_records/:email', async (req, res) => {
    const { email } = req.params;
    console.log('Fetching records for psychologist user:', email); // Log do email do psicólogo
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(dbName);
        const psychologist = await db.collection(psychologistCollectionName).findOne({ email });
        if (psychologist) {
            console.log('Psychologist found:', psychologist); // Log do psicólogo encontrado
            // Busca os usuários atrelados ao psicólogo
            const psychologistUsers = await db.collection(userCollectionName).find({ psychologistEmail: email }).toArray();
            console.log('Users associated with psychologist:', psychologistUsers); // Log dos usuários associados ao psicólogo
            // Inicializa um array para armazenar os registros e os detalhes dos usuários
            let records = [];
            // Para cada usuário encontrado, busca os registros associados e adiciona os detalhes do usuário
            for (const user of psychologistUsers) {
                const userRecords = await db.collection(recordCollectionName).find({ _id_user: user._id }).toArray();
                // Adiciona os registros e os detalhes do usuário ao array
                records.push({ user, records: userRecords });
            }
            console.log('Records retrieved:', records); // Log dos registros recuperados
            res.status(200).json(records); // Retorna os registros e os detalhes dos usuários encontrados
        } else {
            console.log('Psychologist not found:', psychologist); // Log do psicólogo encontrado
            res.status(404).json({ error: 'Psicólogo não encontrado' });
        }
    } catch (err) {
        console.error('Erro ao obter registros dos usuários atrelados ao psicólogo:', err); // Log do erro
        res.status(500).json({ error: 'Erro ao obter registros dos usuários atrelados ao psicólogo' });
    } finally {
        await client.close();
    }
});

app.get('/user_records_by_email/:email', async (req, res) => {
    const { email } = req.params;
    console.log('Fetching records for user:', email); // Log do email do usuário
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(dbName);
        const user = await db.collection(userCollectionName).findOne({ email });
        if (user) {
            console.log('User found:', user); // Log do usuário encontrado
            const userRecords = await db.collection(recordCollectionName).find({ _id_user: user._id }).toArray();
            console.log('Records retrieved:', userRecords); // Log dos registros recuperados
            res.status(200).json({ user, records: userRecords }); // Retorna o usuário e os registros encontrados
        } else {
            console.log('User not found for email:', email);
            res.status(404).json({ error: 'Usuário não encontrado' });
        }
    } catch (err) {
        console.error('Erro ao obter registros do usuário:', err); // Log do erro
        res.status(500).json({ error: 'Erro ao obter registros do usuário' });
    } finally {
        await client.close();
    }
});

app.get('/user_statistics_by_email/:email', async (req, res) => {
    const email = req.params.email;
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(dbName);
        const statistics = await db.collection(statisticsCollectionName).findOne({ email: email });
        if (statistics) {
            res.status(200).json(statistics);
        } else {
            res.status(404).json({ error: 'Estatísticas não encontradas' });
        }
    } catch (err) {
        console.error('Erro ao obter estatísticas:', err);
        res.status(500).json({ error: 'Erro ao acessar as estatísticas' });
    } finally {
        await client.close();
    }
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
