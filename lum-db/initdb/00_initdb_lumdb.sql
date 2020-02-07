-- ========================================================================
-- Copyright (c) 2019-2020 AT&T Intellectual Property. All rights reserved.
-- ========================================================================
-- Unless otherwise specified, all software contained herein is licensed
-- under the Apache License, Version 2.0 (the "License");
-- you may not use this software except in compliance with the License.
-- You may obtain a copy of the License at
--
--             http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing, software
-- distributed under the License is distributed on an "AS IS" BASIS,
-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-- See the License for the specific language governing permissions and
-- limitations under the License.
-- ============LICENSE_END=================================================

\conninfo
CREATE USER lumdb WITH PASSWORD 'lumdb';
CREATE DATABASE lumdb OWNER lumdb;
GRANT ALL PRIVILEGES ON DATABASE lumdb TO lumdb;

COMMENT ON DATABASE lumdb IS 'lumdb is the database for License-Usage-Manager';
