const Knex = require('knex');

class DatabaseController {
    constructor() {
        this.databaseConfig = {
            user: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD,
            database: process.env.SQL_DATABASE,
            host: process.env.SQL_IP
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
        }).then(()=>{
            console.log('added user ' + inputEmail)
        }).catch((error) => {
            console.log(error);
        });
    }
}

module.exports = DatabaseController;