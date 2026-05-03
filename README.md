<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## User API Architecture

User endpoints in this project:

1. `POST /users` create user
2. `GET /users` list users
3. `GET /users/:id` get user by id
4. `PATCH /users/:id` update user
5. `DELETE /users/:id` delete user

```mermaid
flowchart LR
  C[Client / Frontend]
  UC[UsersController]
  US[UsersService]
  PS[PrismaService]
  DB[(PostgreSQL table: users)]

  C -->|POST /users| UC
  C -->|GET /users| UC
  C -->|GET /users/:id| UC
  C -->|PATCH /users/:id| UC
  C -->|DELETE /users/:id| UC

  UC -->|create/findAll/findOne/update/remove| US
  US -->|user.create/findMany/findUnique/update/delete| PS
  PS --> DB
```

### POST /users

```mermaid
sequenceDiagram
  participant Client
  participant Controller as UsersController
  participant Service as UsersService
  participant Prisma as PrismaService
  participant DB as PostgreSQL(users)

  Client->>Controller: POST /users { full_name, email, phone }
  Controller->>Service: create(dto)
  Service->>Prisma: user.create({ data: dto })
  Prisma->>DB: INSERT INTO users ...
  DB-->>Prisma: created row
  Prisma-->>Service: User
  Service-->>Controller: User
  Controller-->>Client: 201 Created
```

### GET /users

```mermaid
sequenceDiagram
  participant Client
  participant Controller as UsersController
  participant Service as UsersService
  participant Prisma as PrismaService
  participant DB as PostgreSQL(users)

  Client->>Controller: GET /users
  Controller->>Service: findAll()
  Service->>Prisma: user.findMany()
  Prisma->>DB: SELECT * FROM users
  DB-->>Prisma: rows
  Prisma-->>Service: User[]
  Service-->>Controller: User[]
  Controller-->>Client: 200 OK
```

### GET /users/:id

```mermaid
sequenceDiagram
  participant Client
  participant Controller as UsersController
  participant Service as UsersService
  participant Prisma as PrismaService
  participant DB as PostgreSQL(users)

  Client->>Controller: GET /users/:id
  Controller->>Service: findOne(id)
  Service->>Prisma: user.findUnique({ where: { id } })
  Prisma->>DB: SELECT ... WHERE id=?
  DB-->>Prisma: row or null
  Prisma-->>Service: User | null
  Service-->>Controller: User or NotFound
  Controller-->>Client: 200 OK or 404 Not Found
```

### PATCH /users/:id

```mermaid
sequenceDiagram
  participant Client
  participant Controller as UsersController
  participant Service as UsersService
  participant Prisma as PrismaService
  participant DB as PostgreSQL(users)

  Client->>Controller: PATCH /users/:id { fields }
  Controller->>Service: update(id, dto)
  Service->>Prisma: user.update({ where: { id }, data: dto })
  Prisma->>DB: UPDATE users SET ...
  DB-->>Prisma: updated row
  Prisma-->>Service: User
  Service-->>Controller: User
  Controller-->>Client: 200 OK
```

### DELETE /users/:id

```mermaid
sequenceDiagram
  participant Client
  participant Controller as UsersController
  participant Service as UsersService
  participant Prisma as PrismaService
  participant DB as PostgreSQL(users)

  Client->>Controller: DELETE /users/:id
  Controller->>Service: remove(id)
  Service->>Prisma: user.delete({ where: { id } })
  Prisma->>DB: DELETE FROM users WHERE id=?
  DB-->>Prisma: deleted row
  Prisma-->>Service: User
  Service-->>Controller: confirmation
  Controller-->>Client: 200 OK or 204 No Content
```

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).



Best Practices for Implementing Webhooks
Always Verify Critical Transaction Data
Before giving value to a customer based on a webhook notification, always re-query our API to verify the transaction details. This helps confirm that the data returned is consistent with what you’re expecting and has not been compromised.

For example, when you receive a successful payment notification, call the transaction verification endpoint to confirm that the status, amount, currency, tx_ref and mode match the expected value in your system before confirming the customer’s order.

Be Idempotent
In some cases, the same webhook event may be delivered more than once—usually due to network delays, timeouts, or retries when your server doesn’t respond with a 200 OK. To prevent duplicate actions (such as crediting a customer multiple times), your webhook processing must be idempotent.

This means that handling the same event multiple times should always produce the same outcome. If your system has already processed that event, simply acknowledge it without repeating any business logic.