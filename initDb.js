require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./db');

async function initializeDatabase() {
  try {
    // Read the schema file
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

    // Execute the schema
    await db.query(schema);
    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database schema:', error);
  } finally {
    // Close the database connection
    await db.end();
  }
}

initializeDatabase(); 