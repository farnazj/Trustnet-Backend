Trustnet-Backend
=

Trustnet-Backend is a Node.js server that uses a MySQL backend.
Using this server, you can follow people or news sources with RSS feeds, boost their content to all or specific targets, add your own posts or import articles from external sources, and post your assessments of the accuracy of articles.

Trustnet-Backend considers [Trustnet-Client](https://github.com/farnazj/Trustnet-Client) as
its client, although it can be configured to use other clients.

### Setup Instructions

#### Install Git and clone this repository
* `git clone https://github.com/farnazj/Trustnet-Backend`

#### Install Node Module Dependencies
cd to the root directory of the project where package.json is. Run:
* `npm install`

#### Database Configurations
Install MySQL Server. Connect to MySQL server using MySQL client and create a database for Trustnet-Backend to connect to. Create a user and grant them privileges on the database.

* `mysql -u root -p` (type the root password when prompted)
* `CREATE DATABASE db_name;`
* `CREATE USER user_name IDENTIFIED BY 'password';`
* `GRANT ALL PRIVILEGES ON db_name.* TO user;`
* `FLUSH PRIVILEGES;`

⚠️ If in trying to connect to the database, Node throws an authentication error, do the following:
* `ALTER USER user IDENTIFIED WITH MYSQL_NATIVE_PASSWORD BY 'password'`

#### Sequelize Configurations
Trustnet-Backend uses Sequelize as an ORM to connect to the database. The database configurations for Sequelize should be in ./config/database.json. Copy the contents of ./config/example_database.json and change the fields username, password, database, and host for whichever environment you are running Trustnet-Backend in (the default environment is development).

#### Setup Environment Variables
The server uses dotenv to load environment variables from a .env file into process.env.

* Create a .env file in the root directory of the project (no name before the extension)
* Place the following variables in the file and assign values to them:

    + ADMIN_KEY=secret (ADMIN_KEY is used for registering RSS feeds of news publishing entities)
    + SESSION_KEY=secret
    + COOKIE_NAME=secret (the name of the sesssion ID cookie that is to be stored in the browser by the client)
    + NODE_ENV (one of 'development', 'test', or 'production'. The default is set to 'development')
    + LOG_LEVEL (refer to [Winston's](https://www.npmjs.com/package/winston) documentation)
    + EMAIL_USER (the email address from which to send account verification and password recovery instructions)
    + EMAIL_PASS (password of the above email address)

#### Redis Server
This Nodejs server stores session ids in a Redis store. In addition, Redis is used for message passing between the processes of the server. You should have [Redis](https://redis.io/download) installed and running on your machine before launching the server.


#### Specify the Client
Upon user signup and also for retrieving an account whose password the user has forgotten, this server sends an email containing the full URL of the client path that should confirm activation/password recovery. Therefore, the client base URL needs to be specified in './lib/constants'

#### Run Trustnet-Backend Server
cd to the root directory of the project. Run:
* `npm start`
