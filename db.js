const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.RDS_HOST,
  user: process.env.RDS_USER,
  password: process.env.RDS_PASSWORD,
  database: process.env.RDS_DB,
  port: 5432,
  ssl: { rejectUnauthorized: false },
});

module.exports = pool;
