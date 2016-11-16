/**
 * react-stack react-stack
 *
 * Copyright © 2016. JonirRings.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import 'babel-polyfill';
import Promise from 'bluebird';
import path from 'path';
import mongoose from 'mongoose';
import express from 'express';
import expressGraphQL from 'express-graphql';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import bodyParser from 'body-parser';
import expressJwt from 'express-jwt';
import jwt from 'jsonwebtoken';
import PrettyError from 'pretty-error';
import React from 'react';
import passport from './core/passport';
import { port, auth, databaseUrl } from './config';
import renderOnServer from './renderOnServer';
import schema from './data/schema';

const isDebug = process.env.NODE_ENV !== 'production';
mongoose.Promise = Promise;
mongoose.connect(databaseUrl);
const app = express();

//
// Tell any CSS tooling (such as Material UI) to use all vendor prefixes if the
// user agent is not known.
// -----------------------------------------------------------------------------
global.navigator = global.navigator || {};
global.navigator.userAgent = global.navigator.userAgent || 'all';

//
// Register Node.js middleware
// -----------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));
app.get('/favicon.ico', (req, res) => res.send(''));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({ secret: 'jonirrings', resave: false, saveUninitialized: false }));

//
// Authentication
// -----------------------------------------------------------------------------
app.use(expressJwt({
  secret: auth.jwt.secret,
  credentialsRequired: false,
  getToken: req => req.cookies.id_token,
}));
app.use(passport.initialize());
app.use(passport.session());

app.get('/login/github',
  passport.authenticate('github', { scope: ['user:email'], session: true })
);
app.get('/login/github/callback',
  passport.authenticate('github', { failureRedirect: '/', session: true }),
  (req, res) => {
    const expiresIn = 60 * 60 * 24 * 180; // 180 days
    const token = jwt.sign(req.user, auth.jwt.secret, { expiresIn });
    res.cookie('id_token', token, { maxAge: 1000 * expiresIn, httpOnly: true });
    res.redirect('/');
  }
);
app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});


app.use('/graphql', expressGraphQL(req => ({
  schema,
  graphiql: isDebug,
  rootValue: { request: req },
  pretty: isDebug,
})));
//
// Register server-side rendering middleware
// -----------------------------------------------------------------------------

app.get('*', renderOnServer);

//
// Error handling
// -----------------------------------------------------------------------------
const pe = new PrettyError();
pe.skipNodeFiles();
pe.skipPackage('express');

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.log(pe.render(err)); // eslint-disable-line no-console
  const html = `<html><body>${err.message}</body></html>`;
  res.status(err.status || 500);
  res.send(`<!doctype html>${html}`);
});

app.listen(port, () => {
  console.log(`The server is running at http://localhost:${port}/`);// eslint-disable-line no-console
});
