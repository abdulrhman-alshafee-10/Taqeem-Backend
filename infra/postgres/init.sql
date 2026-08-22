CREATE DATABASE taqeem_users;
CREATE DATABASE taqeem_businesses;
CREATE DATABASE taqeem_reservations;
CREATE DATABASE taqeem_payments;
CREATE DATABASE taqeem_notifications;
CREATE DATABASE taqeem_social;
CREATE DATABASE taqeem_moderation;
CREATE DATABASE taqeem_feed;
CREATE DATABASE taqeem_unleash;
CREATE DATABASE taqeem_orders;

-- Create pg_trgm extension in search DB for fuzzy text matching
\c taqeem_search;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
