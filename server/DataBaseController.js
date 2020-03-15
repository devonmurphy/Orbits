const Knex = require('knex');

class DatabaseController {
    constructor() {
        this.databaseConfig = {
            host: process.env.RDS_HOSTNAME,
            user: process.env.RDS_USERNAME,
            password: process.env.RDS_PASSWORD,
            port: process.env.RDS_PORT,
            database: 'ebdb'
        };
    }
    connect() {
        // Connect to the database
        this.knex = Knex({
            client: 'pg',
            connection: this.databaseConfig
        });
    }

    checkUserExists(email) {
        var user = this.knex.select('email').from('users').where('email', email)
            .then((user) => {
                if (user.length && user[0].email === email) {
                    console.log('user exists');
                } else {
                    console.log('user does not exist');
                    this.addUser(email);
                }
            }).catch((error) => {
                console.log(error);
            });
    }

    addUser(inputEmail) {
        this.knex('users').insert({
            email: inputEmail
        }).then(() => {
            console.log('added user ');
        }).catch((error) => {
            console.log(error);
        });
    }
}

module.exports = DatabaseController;