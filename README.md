TrustNetBackend
=

TrustNetBackend is a Node.js server that uses a MySQL backend.
Using this server, you can follow people or news sources with RSS feeds, boost their content to all or specific targets, add your own posts or import articles from external sources, and post your assessments of the accuracy of articles.

### Setup Instructions

#### Install Git and clone this repository
* `git clone https://github.com/farnazj/TrustNetBackend`

#### Install Node Module Dependencies
cd to the root directory of the project where package.json is. Run:
* npm install

#### Database Configurations
Install MySQL Server. Connect to MySQL server using MySQL client and create a database for TrustNetBackend to connect to. Create a user and grant them privileges on the database.

* mysql -u root -p (type the root password when prompted)
* CREATE DATABASE db_name;
* CREATE USER user_name IDENTIFIED BY 'password';
* GRANT ALL PRIVILEGES ON db_name.* TO user;
* FLUSH PRIVILEGES;

⚠️ If in trying to connect to the database, Node throws an authentication error, do the following:
* alter user user identified with mysql_native_password by 'password'

#### Sequelize Configurations
TrustNetBackend uses Sequelize as an ORM to connect to the database. The database configurations for Sequelize should be in ./config/config.json. Copy the contents of ./config/example_config.json and change the fields username, password, database, and host for whichever environment you are running TrustNetBackend in (the default environment is development).

#### Setup Environment Variables
The server uses dotenv to load environment variables from a .env file into process.env.

* Create a .env file in the root directory of the project (no name before the extension)
* Place the following variables in the file and assign values to them:
ADMIN_KEY=secret (ADMIN_KEY is used for registering RSS feeds of news publishing entities)
SESSION_KEY=secret
UV_THREADPOOL_SIZE=number (to change the number of threads that will be available in Node's thread pool. Used for simultaneous I/O operations -- the server performs numerous concurrent network operations to update feeds. The variable can have any value from 1 to 128, with the default set to 4.)

#### Run TrustNetBackend Server
cd to the root directory of the project. Run:
* npm start
