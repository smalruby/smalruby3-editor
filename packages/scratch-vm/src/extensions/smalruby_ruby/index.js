// === Smalruby: This file is Smalruby-specific (Ruby String extension) ===

const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const formatMessage = require('format-message');
const Variable = require('../../engine/variable');
const translations = require('./translations.json');

/**
 * Icon svg to be displayed at the left edge of each extension block, encoded as a data URI.
 * Source: ./ruby-logo-icon.svg
 *   (derived from the official Ruby logo, with "PROGRAMMING Language" text removed)
 * To regenerate: base64 ruby-logo-icon.svg, then prepend
 *   "data:image/svg+xml;base64,".
 * @type {string}
 */
 
const blockIconURI = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iMTY4IiBoZWlnaHQ9IjE2OCIgdmlld0JveD0iMzAgMCAxNjggMTY4IiBvdmVyZmxvdz0idmlzaWJsZSI+IDxnIGlkPSJMYXllcl8xIj4gPGxpbmVhckdyYWRpZW50IGlkPSJYTUxJRF8xXyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIHgxPSIxMTQuMDEwNyIgeTE9IjYuMjk1OSIgeDI9IjExNC4wMTA3IiB5Mj0iMTU5LjA2NjkiPiA8c3RvcCBvZmZzZXQ9IjAiIHN0eWxlPSJzdG9wLWNvbG9yOiNBMzBDMDAiLz4gPHN0b3Agb2Zmc2V0PSIwLjA2MzUiIHN0eWxlPSJzdG9wLWNvbG9yOiNBMzBDMDAiLz4gPHN0b3Agb2Zmc2V0PSIwLjQ0OTQiIHN0eWxlPSJzdG9wLWNvbG9yOiNBMzBDMDAiLz4gPHN0b3Agb2Zmc2V0PSIxIiBzdHlsZT0ic3RvcC1jb2xvcjojRkY0MTAwIi8+IDwvbGluZWFyR3JhZGllbnQ+IDxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBmaWxsPSJ1cmwoI1hNTElEXzFfKSIgZD0iTTE4MC42NiwxNTEuNDY5IGMwLjE1LDUuOTgyLTMuMjU0LDcuNTk4LTcuMjcxLDcuNTk4SDU0LjYzMmMtNC4wMTYsMC03LjI3MS0zLjQwMi03LjI3MS03LjU5OFYxMy45NDljMC00LjE5NSwyLjAxOC04LjE4NCw3LjI1Mi03LjY1MyBsMTE4Ljc3NiwwLjA1N2M0LjAxOCwwLDcuMjcxLDMuNDAxLDcuMjcxLDcuNTk2VjE1MS40Njl6Ii8+IDxnPiA8ZGVmcz4gPHBhdGggaWQ9IlhNTElEXzJfIiBkPSJNMTgwLjY3LDE1Mi4wMTRjMCw0LjY1Ni0yLjU5NCw3LjI2Ni03Ljc2Niw3LjAzMWwtMTE3LjgzNiwwLjA0MmMtNC41MzMsMC4xNjEtNy43MjEtMy42NTEtNy43MDctNy42MTggbDAuMDAyLTEzNy43MzVjMC0zLjc5OCwyLjA5NC03LjgxMiw2LjY3NC03LjQ1bDExOS40NDYsMC4wNzVjMy45MzgsMC4wMTYsNy4yNjYsMy41NjIsNy4xNzgsNy41OUwxODAuNjcsMTUyLjAxNHoiLz4gPC9kZWZzPiA8Y2xpcFBhdGggaWQ9IlhNTElEXzNfIj4gPHVzZSB4bGluazpocmVmPSIjWE1MSURfMl8iIC8+IDwvY2xpcFBhdGg+IDxsaW5lYXJHcmFkaWVudCBpZD0iWE1MSURfNF8iIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4MT0iMTI0LjAxMzciIHkxPSIxODcuODQ5NiIgeDI9IjEwMC4wODE2IiB5Mj0iMTQ1LjU5NjMiPiA8c3RvcCBvZmZzZXQ9IjAiIHN0eWxlPSJzdG9wLWNvbG9yOiNGQjc2NTUiLz4gPHN0b3Agb2Zmc2V0PSIwIiBzdHlsZT0ic3RvcC1jb2xvcjojRkI3NjU1Ii8+IDxzdG9wIG9mZnNldD0iMC40MSIgc3R5bGU9InN0b3AtY29sb3I6I0U0MkIxRSIvPiA8c3RvcCBvZmZzZXQ9IjAuOTkiIHN0eWxlPSJzdG9wLWNvbG9yOiM5OTAwMDAiLz4gPHN0b3Agb2Zmc2V0PSIxIiBzdHlsZT0ic3RvcC1jb2xvcjojOTkwMDAwIi8+IDwvbGluZWFyR3JhZGllbnQ+IDxwYXRoIGNsaXAtcGF0aD0idXJsKCNYTUxJRF8zXykiIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBmaWxsPSJ1cmwoI1hNTElEXzRfKSIgZD0iIE00Ny40NjQsMTc3LjU2NGw4My44NjctNS42OTVsNi40NTgtODQuNTYzTDExMi4yMzgsMTM5LjFMNDcuNDY0LDE3Ny41NjR6Ii8+IDxsaW5lYXJHcmFkaWVudCBpZD0iWE1MSURfNV8iIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4MT0iMTM1LjkzNzUiIHkxPSIxNTIuMzUzNSIgeDI9IjEwNS4wOTQ5IiB5Mj0iMTMxLjY1NjMiPiA8c3RvcCBvZmZzZXQ9IjAiIHN0eWxlPSJzdG9wLWNvbG9yOiM4NzExMDEiLz4gPHN0b3Agb2Zmc2V0PSIwIiBzdHlsZT0ic3RvcC1jb2xvcjojODcxMTAxIi8+IDxzdG9wIG9mZnNldD0iMC45OSIgc3R5bGU9InN0b3AtY29sb3I6IzkxMTIwOSIvPiA8c3RvcCBvZmZzZXQ9IjEiIHN0eWxlPSJzdG9wLWNvbG9yOiM5MTEyMDkiLz4gPC9saW5lYXJHcmFkaWVudD4gPHBhdGggY2xpcC1wYXRoPSJ1cmwoI1hNTElEXzNfKSIgZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGZpbGw9InVybCgjWE1MSURfNV8pIiBkPSIgTTEwNC42MjUsMTQ3Ljk4OGwyNi44NDMsMjMuODI0bC03LjIwOC00OS43NTNMMTA0LjYyNSwxNDcuOTg4eiIvPiA8bGluZWFyR3JhZGllbnQgaWQ9IlhNTElEXzZfIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgeDE9IjExMS4yNTk4IiB5MT0iMTg5LjEyODkiIHgyPSI4MC40MTY4IiB5Mj0iMTY4LjQzMTQiPiA8c3RvcCBvZmZzZXQ9IjAiIHN0eWxlPSJzdG9wLWNvbG9yOiM4NzExMDEiLz4gPHN0b3Agb2Zmc2V0PSIwIiBzdHlsZT0ic3RvcC1jb2xvcjojODcxMTAxIi8+IDxzdG9wIG9mZnNldD0iMC45OSIgc3R5bGU9InN0b3AtY29sb3I6IzkxMTIwOSIvPiA8c3RvcCBvZmZzZXQ9IjEiIHN0eWxlPSJzdG9wLWNvbG9yOiM5MTEyMDkiLz4gPC9saW5lYXJHcmFkaWVudD4gPHBhdGggY2xpcC1wYXRoPSJ1cmwoI1hNTElEXzNfKSIgZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGZpbGw9InVybCgjWE1MSURfNl8pIiBkPSIgTTQ3Ljc0NiwxNzcuNDUxbDgzLjgyLTUuNjM5bC01Mi44MDgtNC4xNDhMNDcuNzQ2LDE3Ny40NTF6Ii8+IDxsaW5lYXJHcmFkaWVudCBpZD0iWE1MSURfN18iIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4MT0iNDYuNDk5NSIgeTE9IjEzNy4zNzExIiB4Mj0iNTEuMjgxMSIgeTI9IjE2OC40NDY0Ij4gPHN0b3Agb2Zmc2V0PSIwIiBzdHlsZT0ic3RvcC1jb2xvcjojRkZGRkZGIi8+IDxzdG9wIG9mZnNldD0iMCIgc3R5bGU9InN0b3AtY29sb3I6I0ZGRkZGRiIvPiA8c3RvcCBvZmZzZXQ9IjAuMjMiIHN0eWxlPSJzdG9wLWNvbG9yOiNFNTcyNTIiLz4gPHN0b3Agb2Zmc2V0PSIwLjQ2IiBzdHlsZT0ic3RvcC1jb2xvcjojREUzQjIwIi8+IDxzdG9wIG9mZnNldD0iMC45OSIgc3R5bGU9InN0b3AtY29sb3I6I0EwMDAwMCIvPiA8c3RvcCBvZmZzZXQ9IjEiIHN0eWxlPSJzdG9wLWNvbG9yOiNBMDAwMDAiLz4gPC9saW5lYXJHcmFkaWVudD4gPHBhdGggY2xpcC1wYXRoPSJ1cmwoI1hNTElEXzNfKSIgZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGZpbGw9InVybCgjWE1MSURfN18pIiBkPSIgTTMxLjk4MiwxNDAuNDUzbDE1LjgzOCwzNy4wMWwxMy4xOTEtNDMuMjE5TDMxLjk4MiwxNDAuNDUzeiIvPiA8bGluZWFyR3JhZGllbnQgaWQ9IlhNTElEXzhfIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgeDE9IjkyLjQ2OTciIHkxPSI3MS4wMzg2IiB4Mj0iMTE1LjE5NjkiIHkyPSI1OS42NzUiPiA8c3RvcCBvZmZzZXQ9IjAiIHN0eWxlPSJzdG9wLWNvbG9yOiNGRkZGRkYiLz4gPHN0b3Agb2Zmc2V0PSIwIiBzdHlsZT0ic3RvcC1jb2xvcjojRkZGRkZGIi8+IDxzdG9wIG9mZnNldD0iMC41NCIgc3R5bGU9InN0b3AtY29sb3I6I0M4MUYxMSIvPiA8c3RvcCBvZmZzZXQ9IjAuOTkiIHN0eWxlPSJzdG9wLWNvbG9yOiNCRjA5MDQiLz4gPHN0b3Agb2Zmc2V0PSIxIiBzdHlsZT0ic3RvcC1jb2xvcjojQkYwOTA0Ii8+IDwvbGluZWFyR3JhZGllbnQ+IDxwYXRoIGNsaXAtcGF0aD0idXJsKCNYTUxJRF8zXykiIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBmaWxsPSJ1cmwoI1hNTElEXzhfKSIgZD0iIE04OC4xODMsNjQuNzI4bDMxLjQ5NywwLjE0MmwtMTkuMzEzLDEwLjY3NEw4OC4xODMsNjQuNzI4eiIvPiA8bGluZWFyR3JhZGllbnQgaWQ9IlhNTElEXzlfIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgeDE9IjI2LjU4MDEiIHkxPSIxMjkuNDQ5MiIgeDI9IjI4LjQ1MDciIHkyPSIxNDguMTc4MyI+IDxzdG9wIG9mZnNldD0iMCIgc3R5bGU9InN0b3AtY29sb3I6I0ZGRkZGRiIvPiA8c3RvcCBvZmZzZXQ9IjAiIHN0eWxlPSJzdG9wLWNvbG9yOiNGRkZGRkYiLz4gPHN0b3Agb2Zmc2V0PSIwLjMxIiBzdHlsZT0ic3RvcC1jb2xvcjojREU0MDI0Ii8+IDxzdG9wIG9mZnNldD0iMC45OSIgc3R5bGU9InN0b3AtY29sb3I6I0JGMTkwQiIvPiA8c3RvcCBvZmZzZXQ9IjEiIHN0eWxlPSJzdG9wLWNvbG9yOiNCRjE5MEIiLz4gPC9saW5lYXJHcmFkaWVudD4gPHBhdGggY2xpcC1wYXRoPSJ1cmwoI1hNTElEXzNfKSIgZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGZpbGw9InVybCgjWE1MSURfOV8pIiBkPSIgTTI1Ljg5LDEyMi42MTZsLTEuNTQ1LDMyLjMzNWw4LjA5LTE0Ljc1OEwyNS44OSwxMjIuNjE2eiIvPiA8cGF0aCBjbGlwLXBhdGg9InVybCgjWE1MSURfM18pIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZmlsbD0iIzlFMTIwOSIgZD0iTTI0LjM0NSwxNTQuNzU2IGMwLjYxNywyMi4yNDQsMTYuNjY4LDIyLjU3NiwyMy41MDQsMjIuNzcxbC0xNS43OTMtMzYuODgzTDI0LjM0NSwxNTQuNzU2eiIvPiA8bGluZWFyR3JhZGllbnQgaWQ9IlhNTElEXzEwXyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIHgxPSIzOS42MTU3IiB5MT0iMTc3LjQyMTkiIHgyPSIzMC4wNjQzIiB5Mj0iMTQ1LjAxNzEiPiA8c3RvcCBvZmZzZXQ9IjAiIHN0eWxlPSJzdG9wLWNvbG9yOiM4QjIxMTQiLz4gPHN0b3Agb2Zmc2V0PSIwIiBzdHlsZT0ic3RvcC1jb2xvcjojOEIyMTE0Ii8+IDxzdG9wIG9mZnNldD0iMC40MyIgc3R5bGU9InN0b3AtY29sb3I6IzlFMTAwQSIvPiA8c3RvcCBvZmZzZXQ9IjAuOTkiIHN0eWxlPSJzdG9wLWNvbG9yOiNCMzEwMEMiLz4gPHN0b3Agb2Zmc2V0PSIxIiBzdHlsZT0ic3RvcC1jb2xvcjojQjMxMDBDIi8+IDwvbGluZWFyR3JhZGllbnQ+IDxwYXRoIGNsaXAtcGF0aD0idXJsKCNYTUxJRF8zXykiIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBmaWxsPSJ1cmwoI1hNTElEXzEwXykiIGQ9IiBNMzEuOTg4LDE0MC42OTFsLTIuNDc5LDI5LjUyNWM0LjY3OCw2LjM4NywxMS4xMTEsNi45NDMsMTcuODY1LDYuNDQ1QzQyLjQ4OCwxNjQuNTA4LDMyLjczMiwxNDAuMTk5LDMxLjk4OCwxNDAuNjkxeiIvPiA8bGluZWFyR3JhZGllbnQgaWQ9IlhNTElEXzExXyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIHgxPSIxMTIuODkwNiIgeTE9IjcwLjAzOTYiIHgyPSIxMzQuMzAyNCIgeTI9Ijc5LjQ5MTEiPiA8c3RvcCBvZmZzZXQ9IjAiIHN0eWxlPSJzdG9wLWNvbG9yOiNCMzEwMDAiLz4gPHN0b3Agb2Zmc2V0PSIwIiBzdHlsZT0ic3RvcC1jb2xvcjojQjMxMDAwIi8+IDxzdG9wIG9mZnNldD0iMC40NCIgc3R5bGU9InN0b3AtY29sb3I6IzkxMEYwOCIvPiA8c3RvcCBvZmZzZXQ9IjAuOTkiIHN0eWxlPSJzdG9wLWNvbG9yOiM3OTFDMTIiLz4gPHN0b3Agb2Zmc2V0PSIxIiBzdHlsZT0ic3RvcC1jb2xvcjojNzkxQzEyIi8+IDwvbGluZWFyR3JhZGllbnQ+IDxwYXRoIGNsaXAtcGF0aD0idXJsKCNYTUxJRF8zXykiIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBmaWxsPSJ1cmwoI1hNTElEXzExXykiIGQ9IiBNMTAyLjE2LDc0LjUxMmwzNC43NTgsNC44ODFjLTEuODU0LTcuODY0LTcuNTUxLTEyLjkzOC0xNy4yNi0xNC41MjNMMTAyLjE2LDc0LjUxMnoiLz4gPGc+IDxwYXRoIGNsaXAtcGF0aD0idXJsKCNYTUxJRF8zXykiIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBmaWxsPSIjRkZGRkZGIiBkPSJNNjIuMTkxLDczLjg3OCBMMzguNDc2LDk0LjM0bC0xNC42NDMsMjYuOTczbC0xLjAyMSwzMi40MzNjLTAuMzEyLDcuNjUyLDEuNzE1LDEzLjY3Niw2LjAyNywxNy44OThjNy4yMjMsNy4wNzIsMTguNDA0LDguMDA0LDE4Ljg2NSw3Ljk3NSBjLTEuNDY5LDAuMTI5LTAuMTY0LDAuMDE0LDgzLjA5Mi02LjgyOGw3Ljk3OS02OC4xNzRjMS4wNzYtNi45NzksMS43NS0xMC4zNTksMS43NS0xNGMwLTUuNzg3LTAuOTA0LTExLjM2Ny0xLjI1LTEyIGMtMi43NjgtMTQuMDk0LTE4LjA5LTE1LjQ5Mi0xOC4yNDgtMTUuNWMtMC4wMjUtMC4wMDItMzYuMTQ3LDAuMjA5LTM2LjE0NywwLjIwOUw2Mi4xOTEsNzMuODc4eiBNODcuMzY3LDY0LjUyOCBjMC4zOTMsMC4wMSwzMS4yMzcsMC43NTYsMzEuMjM3LDAuNzU2YzAuNTYyLDAuMDI5LDE0LjQzLDAuODk4LDE2Ljc4OCwxMy42MzNsMC4wMzMsMC4xOGwwLjEwOSwwLjE4IGMwLjAxNiwwLjAyNSwwLjk5OSwxLjc2OCwwLjk5OSw3Ljc2YzAsMy41MDQtMC4zMzcsOC40NjEtMS40MDEsMTUuMzc5Yy0wLjAwOCwwLjA2OC00LjY1NSw1OS44MzUtNS4yNjUsNjcuNjY3IGMtMS42OCwwLjEyMS04Mi41NDksNi4wMjEtODIuNTQ5LDYuMDIxYy0wLjA5NCwwLjAwNi0xMC41MTQsMC41NTMtMTcuMDktNS44OThjLTMuNjE3LTMuNTQ5LTUuNDQ1LTguNTc2LTUuNDQ1LTE0Ljk1OSBjMC0wLjQ2OSwwLjAxLTAuOTQ1LDAuMDI5LTEuNDI4YzAtMC4wMSwwLjkzLTI5LjU0MywxLjAwNi0zMS45NjhjMC4yMjMtMC40MDgsMTQuMTA5LTI1Ljk5LDE0LjI2Mi0yNi4yNyBjMC4yMzItMC4yMTksMjMuMDM3LTIxLjU1MywyMy4zMTYtMjEuODEyQzYzLjc1MSw3My42MzEsODcuMDA1LDY0LjY2OCw4Ny4zNjcsNjQuNTI4eiIvPiA8L2c+IDxwYXRoIGNsaXAtcGF0aD0idXJsKCNYTUxJRF8zXykiIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBmaWxsPSJub25lIiBzdHJva2U9IiNGRkZGRkYiIGQ9IiBNNDcuNDY2LDE3Ny41NjRsODMuODY2LTUuNjk1bDYuNDU3LTg0LjU2NGwtMjUuNTUxLDUxLjc5Nkw0Ny40NjYsMTc3LjU2NHoiLz4gPHBhdGggY2xpcC1wYXRoPSJ1cmwoI1hNTElEXzNfKSIgZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0ZGRkZGRiIgZD0iIE0xMDQuNjIzLDE0Ny45ODZsMjYuODQ2LDIzLjgyNmwtNy4xOTktNDguOTgyTDEwNC42MjMsMTQ3Ljk4NnoiLz4gPHBhdGggY2xpcC1wYXRoPSJ1cmwoI1hNTElEXzNfKSIgZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0ZGRkZGRiIgZD0iIE00Ny43NDYsMTc3LjQ1MWw4My44MjEtNS42MzlsLTUyLjgwOS00LjE0OEw0Ny43NDYsMTc3LjQ1MXoiLz4gPHBhdGggY2xpcC1wYXRoPSJ1cmwoI1hNTElEXzNfKSIgZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0ZGRkZGRiIgZD0iIE0zMS45ODIsMTQwLjQ1MWwxNS44MzgsMzcuMDEybDEzLjE5MS00My4yMTlMMzEuOTgyLDE0MC40NTF6Ii8+IDxwYXRoIGNsaXAtcGF0aD0idXJsKCNYTUxJRF8zXykiIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBmaWxsPSJub25lIiBzdHJva2U9IiNGRkZGRkYiIGQ9IiBNODguMTgzLDY0LjcyN2wzMS40OTcsMC4xNDNsLTE3LjUyMSw5LjY0M0w4OC4xODMsNjQuNzI3eiIvPiA8cGF0aCBjbGlwLXBhdGg9InVybCgjWE1MSURfM18pIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjRkZGRkZGIiBkPSIgTTI1LjQ1NSwxMjIuMDYxbC0xLjEwOSwzMi44ODhsOC4wOS0xNC43NTZMMjUuNDU1LDEyMi4wNjF6Ii8+IDxwYXRoIGNsaXAtcGF0aD0idXJsKCNYTUxJRF8zXykiIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBmaWxsPSJub25lIiBzdHJva2U9IiNGRkZGRkYiIGQ9IiBNMTM1LjEwNCwxMDEuMjk3YzQuNDYyLTEzLjQ3OSw1LjQ5My0zMi44MTQtMTUuNTYyLTM2LjQwNGwtMTcuMjgzLDkuNTQ1TDEzNS4xMDQsMTAxLjI5N3oiLz4gPHBhdGggY2xpcC1wYXRoPSJ1cmwoI1hNTElEXzNfKSIgZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0ZGRkZGRiIgZD0iIE0yNC4zNDUsMTU0Ljc1NGMwLjYxNywyMi4yNDYsMTYuNjY4LDIyLjU3OCwyMy41MDQsMjIuNzczbC0xNS43OTEtMzYuODgzTDI0LjM0NSwxNTQuNzU0eiIvPiA8cGF0aCBjbGlwLXBhdGg9InVybCgjWE1MSURfM18pIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjRkZGRkZGIiBkPSIgTTMxLjk4OCwxNDAuNjkxbC0yLjQ3OSwyOS41MjVjNC42NzgsNi4zODcsMTEuMTEzLDYuOTQzLDE3Ljg2NSw2LjQ0NUM0Mi40OSwxNjQuNTA4LDMyLjczMiwxNDAuMjAxLDMxLjk4OCwxNDAuNjkxeiIvPiA8bGluZWFyR3JhZGllbnQgaWQ9IlhNTElEXzEyXyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIHgxPSI3OS4zODgyIiB5MT0iMTA4LjM1NiIgeDI9IjgxLjE0OTkiIHkyPSIxNDAuMDY5OSI+IDxzdG9wIG9mZnNldD0iMCIgc3R5bGU9InN0b3AtY29sb3I6I0ZGRkZGRiIvPiA8c3RvcCBvZmZzZXQ9IjAiIHN0eWxlPSJzdG9wLWNvbG9yOiNGRkZGRkYiLz4gPHN0b3Agb2Zmc2V0PSIwLjIzIiBzdHlsZT0ic3RvcC1jb2xvcjojRTQ3MTRFIi8+IDxzdG9wIG9mZnNldD0iMC41NiIgc3R5bGU9InN0b3AtY29sb3I6I0JFMUEwRCIvPiA8c3RvcCBvZmZzZXQ9IjAuOTkiIHN0eWxlPSJzdG9wLWNvbG9yOiNBODBEMDAiLz4gPHN0b3Agb2Zmc2V0PSIxIiBzdHlsZT0ic3RvcC1jb2xvcjojQTgwRDAwIi8+IDwvbGluZWFyR3JhZGllbnQ+IDxwYXRoIGNsaXAtcGF0aD0idXJsKCNYTUxJRF8zXykiIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBmaWxsPSJ1cmwoI1hNTElEXzEyXykiIGQ9IiBNNTcuNzQ0LDEzMy4xNDZsNDYuODc1LDE0Ljk4NGwtMTIuMTM1LTQ3LjU0N0w1Ny43NDQsMTMzLjE0NnoiLz4gPGxpbmVhckdyYWRpZW50IGlkPSJYTUxJRF8xM18iIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4MT0iMTA4LjU3MjMiIHkxPSI3OS4wNDM1IiB4Mj0iMTEzLjg0NjYiIHkyPSIxMDEuNzczNCI+IDxzdG9wIG9mZnNldD0iMCIgc3R5bGU9InN0b3AtY29sb3I6I0ZGRkZGRiIvPiA8c3RvcCBvZmZzZXQ9IjAiIHN0eWxlPSJzdG9wLWNvbG9yOiNGRkZGRkYiLz4gPHN0b3Agb2Zmc2V0PSIwLjE4IiBzdHlsZT0ic3RvcC1jb2xvcjojRTQ2MzQyIi8+IDxzdG9wIG9mZnNldD0iMC40IiBzdHlsZT0ic3RvcC1jb2xvcjojQzgyNDEwIi8+IDxzdG9wIG9mZnNldD0iMC45OSIgc3R5bGU9InN0b3AtY29sb3I6I0E4MEQwMCIvPiA8c3RvcCBvZmZzZXQ9IjEiIHN0eWxlPSJzdG9wLWNvbG9yOiNBODBEMDAiLz4gPC9saW5lYXJHcmFkaWVudD4gPHBhdGggY2xpcC1wYXRoPSJ1cmwoI1hNTElEXzNfKSIgZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGZpbGw9InVybCgjWE1MSURfMTNfKSIgZD0iIE05My4wNTQsMTAzLjk5NWw0MS45NzktMi43NGwtMzIuODM4LTI2LjgyMUw5My4wNTQsMTAzLjk5NXoiLz4gPGxpbmVhckdyYWRpZW50IGlkPSJYTUxJRF8xNF8iIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4MT0iODEuMDcyOCIgeTE9IjE2Mi4zNjA0IiB4Mj0iNTQuNTg2MyIgeTI9IjE1NS44MjMzIj4gPHN0b3Agb2Zmc2V0PSIwIiBzdHlsZT0ic3RvcC1jb2xvcjojOEMwQzAxIi8+IDxzdG9wIG9mZnNldD0iMCIgc3R5bGU9InN0b3AtY29sb3I6IzhDMEMwMSIvPiA8c3RvcCBvZmZzZXQ9IjAuNTQiIHN0eWxlPSJzdG9wLWNvbG9yOiM5OTBDMDAiLz4gPHN0b3Agb2Zmc2V0PSIwLjk5IiBzdHlsZT0ic3RvcC1jb2xvcjojQTgwRDBFIi8+IDxzdG9wIG9mZnNldD0iMSIgc3R5bGU9InN0b3AtY29sb3I6I0E4MEQwRSIvPiA8L2xpbmVhckdyYWRpZW50PiA8cGF0aCBjbGlwLXBhdGg9InVybCgjWE1MSURfM18pIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZmlsbD0idXJsKCNYTUxJRF8xNF8pIiBkPSIgTTQ3LjgyLDE3Ny40NDdsMTMuMDktNDMuMzU3bDQzLjQ3MSwxMy45NjVDODguNjYyLDE2Mi43OTMsNzEuMTgxLDE3NS4yNTQsNDcuODIsMTc3LjQ0N3oiLz4gPGxpbmVhckdyYWRpZW50IGlkPSJYTUxJRF8xNV8iIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4MT0iMTI2LjQ2MzkiIHkxPSIxMzAuNDgwNSIgeDI9IjEwMy4wMTE3IiB5Mj0iMTA5LjQ2MSI+IDxzdG9wIG9mZnNldD0iMCIgc3R5bGU9InN0b3AtY29sb3I6IzdFMTEwQiIvPiA8c3RvcCBvZmZzZXQ9IjAiIHN0eWxlPSJzdG9wLWNvbG9yOiM3RTExMEIiLz4gPHN0b3Agb2Zmc2V0PSIwLjk5IiBzdHlsZT0ic3RvcC1jb2xvcjojOUUwQzAwIi8+IDxzdG9wIG9mZnNldD0iMSIgc3R5bGU9InN0b3AtY29sb3I6IzlFMEMwMCIvPiA8L2xpbmVhckdyYWRpZW50PiA8cGF0aCBjbGlwLXBhdGg9InVybCgjWE1MSURfM18pIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZmlsbD0idXJsKCNYTUxJRF8xNV8pIiBkPSIgTTkzLjM3OCwxMDMuODc1bDExLjE1OSw0NC4yMDNjMTMuMTI3LTEzLjgwMywyNC45MS0yOC42NDQsMzAuNjgtNDcuMDAzTDkzLjM3OCwxMDMuODc1eiIvPiA8bGluZWFyR3JhZGllbnQgaWQ9IlhNTElEXzE2XyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIHgxPSIxMzUuMTg3NSIgeTE9IjkxLjg5ODQiIHgyPSIxMjMuNDY3NCIgeTI9Ijc5LjM2ODgiPiA8c3RvcCBvZmZzZXQ9IjAiIHN0eWxlPSJzdG9wLWNvbG9yOiM3OTEzMEQiLz4gPHN0b3Agb2Zmc2V0PSIwIiBzdHlsZT0ic3RvcC1jb2xvcjojNzkxMzBEIi8+IDxzdG9wIG9mZnNldD0iMC45OSIgc3R5bGU9InN0b3AtY29sb3I6IzlFMTIwQiIvPiA8c3RvcCBvZmZzZXQ9IjEiIHN0eWxlPSJzdG9wLWNvbG9yOiM5RTEyMEIiLz4gPC9saW5lYXJHcmFkaWVudD4gPHBhdGggY2xpcC1wYXRoPSJ1cmwoI1hNTElEXzNfKSIgZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGZpbGw9InVybCgjWE1MSURfMTZfKSIgZD0iIE0xMzUuMTA0LDEwMS4yOThjNC40NjUtMTMuNDc5LDUuNDk0LTMyLjgxNS0xNS41NTktMzYuNDA1bC0xNy4yODMsOS41NDVMMTM1LjEwNCwxMDEuMjk4eiIvPiA8cmFkaWFsR3JhZGllbnQgaWQ9IlhNTElEXzE3XyIgY3g9IjEwNi43MDAyIiBjeT0iMTA5Ljg4NDgiIHI9IjI4LjgzMTIiIGZ4PSIxMDYuNzAwMiIgZnk9IjEwOS44ODQ4IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+IDxzdG9wIG9mZnNldD0iMCIgc3R5bGU9InN0b3AtY29sb3I6I0E4MEQwMCIvPiA8c3RvcCBvZmZzZXQ9IjAiIHN0eWxlPSJzdG9wLWNvbG9yOiNBODBEMDAiLz4gPHN0b3Agb2Zmc2V0PSIwLjk5IiBzdHlsZT0ic3RvcC1jb2xvcjojN0UwRTA4Ii8+IDxzdG9wIG9mZnNldD0iMSIgc3R5bGU9InN0b3AtY29sb3I6IzdFMEUwOCIvPiA8L3JhZGlhbEdyYWRpZW50PiA8cGF0aCBjbGlwLXBhdGg9InVybCgjWE1MSURfM18pIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZmlsbD0idXJsKCNYTUxJRF8xN18pIiBkPSIgTTkzLjQzOSwxMDMuOTQzYzEwLjA4OCw2LjIwMSwzMC40MiwxOC42NTUsMzAuODMzLDE4Ljg4NmMwLjY0MywwLjM1OSw4Ljc2Ny0xMy43MDEsMTAuNjA5LTIxLjY1Mkw5My40MzksMTAzLjk0M3oiLz4gPHJhZGlhbEdyYWRpZW50IGlkPSJYTUxJRF8xOF8iIGN4PSI2Ni43Njg2IiBjeT0iMTQ3Ljg4NDgiIHI9IjM4LjMzMTMiIGZ4PSI2Ni43Njg2IiBmeT0iMTQ3Ljg4NDgiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4gPHN0b3Agb2Zmc2V0PSIwIiBzdHlsZT0ic3RvcC1jb2xvcjojQTMwQzAwIi8+IDxzdG9wIG9mZnNldD0iMCIgc3R5bGU9InN0b3AtY29sb3I6I0EzMEMwMCIvPiA8c3RvcCBvZmZzZXQ9IjAuOTkiIHN0eWxlPSJzdG9wLWNvbG9yOiM4MDBFMDgiLz4gPHN0b3Agb2Zmc2V0PSIxIiBzdHlsZT0ic3RvcC1jb2xvcjojODAwRTA4Ii8+IDwvcmFkaWFsR3JhZGllbnQ+IDxwYXRoIGNsaXAtcGF0aD0idXJsKCNYTUxJRF8zXykiIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBmaWxsPSJ1cmwoI1hNTElEXzE4XykiIGQ9IiBNNjAuODkyLDEzNC4wOWwxNy40OTgsMzMuNzYyYzEwLjM1LTUuNjExLDE4LjQ1MS0xMi40NDksMjUuODctMTkuNzczTDYwLjg5MiwxMzQuMDl6Ii8+IDxwYXRoIGNsaXAtcGF0aD0idXJsKCNYTUxJRF8zXykiIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBmaWxsPSJub25lIiBzdHJva2U9IiNGRkZGRkYiIGQ9IiBNNjAuODkyLDEzNC4wOWw0My43MjcsMTQuMDM5bC0xMS4xNzgtNDQuMTg3TDYwLjg5MiwxMzQuMDl6Ii8+IDxwYXRoIGNsaXAtcGF0aD0idXJsKCNYTUxJRF8zXykiIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBmaWxsPSJub25lIiBzdHJva2U9IiNGRkZGRkYiIGQ9IiBNOTMuMDU2LDEwMy45OTVsNDEuOTc4LTIuNzRsLTMyLjgzOS0yNi44MjJMOTMuMDU2LDEwMy45OTV6Ii8+IDxwYXRoIGNsaXAtcGF0aD0idXJsKCNYTUxJRF8zXykiIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBmaWxsPSJub25lIiBzdHJva2U9IiNGRkZGRkYiIGQ9IiBNNDcuODIsMTc3LjQ0N2wxMy4wOS00My4zNTdsNDMuNDY5LDEzLjk2NUM4OC42NjIsMTYyLjc5Myw3MS4xODEsMTc1LjI1NCw0Ny44MiwxNzcuNDQ3eiIvPiA8cGF0aCBjbGlwLXBhdGg9InVybCgjWE1MSURfM18pIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjRkZGRkZGIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0iIE05My4zNzgsMTAzLjg3NWwxMS4xNTcsNDQuMjAzYzExLjA2MS0xMS42MjksMjUuOTE4LTMxLjg0MywzMC42ODMtNDcuMDAzTDkzLjM3OCwxMDMuODc1eiIvPiA8cGF0aCBjbGlwLXBhdGg9InVybCgjWE1MSURfM18pIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjRkZGRkZGIiBzdHJva2Utd2lkdGg9IjAuNSIgZD0iIE05My40NDEsMTAzLjk0MmMxMC4wODYsNi4yMDEsMzAuNDE4LDE4LjY1NiwzMC44MjksMTguODg5YzAuNjQzLDAuMzU5LDguNzY4LTEzLjcwMywxMC42MS0yMS42NTRMOTMuNDQxLDEwMy45NDJ6Ii8+IDxwYXRoIGNsaXAtcGF0aD0idXJsKCNYTUxJRF8zXykiIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBmaWxsPSJub25lIiBzdHJva2U9IiNGRkZGRkYiIHN0cm9rZS13aWR0aD0iMC41IiBkPSIgTTYwLjg5MiwxMzQuMDlsMTcuNDk4LDMzLjc2MmMxMC4zNS01LjYxMSwxOC40NTEtMTIuNDQ5LDI1Ljg3LTE5Ljc3M0w2MC44OTIsMTM0LjA5eiIvPiA8cGF0aCBjbGlwLXBhdGg9InVybCgjWE1MSURfM18pIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjRkZGRkZGIiBzdHJva2Utd2lkdGg9IjAuNSIgZD0iIE0xMDIuMTU4LDc0LjUxMmwzNC43Niw0Ljg4MWMtMS44NTMtNy44NjUtNy41NTEtMTIuOTM4LTE3LjI2LTE0LjUyM0wxMDIuMTU4LDc0LjUxMnoiLz4gPHBhdGggY2xpcC1wYXRoPSJ1cmwoI1hNTElEXzNfKSIgZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0ZGRkZGRiIgZD0iIE0yNS40NTUsMTIyLjA2MWw2LjU4NiwxOC42NzdsMjguNjExLTYuNDE2bDMyLjY3LTMwLjM2MWw5LjIxNS0yOS4yODNsLTE0LjUxNi0xMC4yNWwtMjQuNjc2LDkuMjM2IGMtNy43NzcsNy4yMzItMjIuODY1LDIxLjU0MS0yMy40MSwyMS44MTJDMzkuMzk4LDk1Ljc1MiwyOS45NzIsMTEzLjU2MywyNS40NTUsMTIyLjA2MXoiLz4gPHBhdGggY2xpcC1wYXRoPSJ1cmwoI1hNTElEXzNfKSIgZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGZpbGw9IiNGRkZGRkYiIHN0cm9rZT0iI0ZGRkZGRiIgZD0iIE0yNS40NTUsMTIyLjA1OWw2LjU4NiwxOC42NzlsMjguNjExLTYuNDE2bDMyLjY2OC0zMC4zNjFsOS4yMTctMjkuMjgzbC0xNC4zNTQtOS45NWwtMjQuODQsOC45MzggYy03Ljc3NSw3LjIzMS0yMi44NjMsMjEuNTQxLTIzLjQwOCwyMS44MTJDMzkuMzk4LDk1Ljc1MiwyOS45NzIsMTEzLjU2MywyNS40NTUsMTIyLjA1OXoiLz4gPGxpbmVhckdyYWRpZW50IGlkPSJYTUxJRF8xOV8iIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4MT0iMTMuNzIwNyIgeTE9IjE1My4yMzgzIiB4Mj0iMTAxLjY1MjEiIHkyPSI2Mi44MjAyIj4gPHN0b3Agb2Zmc2V0PSIwIiBzdHlsZT0ic3RvcC1jb2xvcjojQkYwMDAwIi8+IDxzdG9wIG9mZnNldD0iMCIgc3R5bGU9InN0b3AtY29sb3I6I0JGMDAwMCIvPiA8c3RvcCBvZmZzZXQ9IjAuMDciIHN0eWxlPSJzdG9wLWNvbG9yOiNGRkZGRkYiLz4gPHN0b3Agb2Zmc2V0PSIwLjE3IiBzdHlsZT0ic3RvcC1jb2xvcjojRkZGRkZGIi8+IDxzdG9wIG9mZnNldD0iMC4yNyIgc3R5bGU9InN0b3AtY29sb3I6I0M4MkYxQyIvPiA8c3RvcCBvZmZzZXQ9IjAuMzMiIHN0eWxlPSJzdG9wLWNvbG9yOiM4MjBDMDEiLz4gPHN0b3Agb2Zmc2V0PSIwLjQ2IiBzdHlsZT0ic3RvcC1jb2xvcjojQTMxNjAxIi8+IDxzdG9wIG9mZnNldD0iMC43MiIgc3R5bGU9InN0b3AtY29sb3I6I0IzMTMwMCIvPiA8c3RvcCBvZmZzZXQ9IjAuOTkiIHN0eWxlPSJzdG9wLWNvbG9yOiNFODI2MDkiLz4gPHN0b3Agb2Zmc2V0PSIxIiBzdHlsZT0ic3RvcC1jb2xvcjojRTgyNjA5Ii8+IDwvbGluZWFyR3JhZGllbnQ+IDxwYXRoIGNsaXAtcGF0aD0idXJsKCNYTUxJRF8zXykiIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBmaWxsPSJ1cmwoI1hNTElEXzE5XykiIGQ9IiBNNDguNTc2LDg4LjUwN2MxNi44NTItMTYuNzA4LDM4LjU3OC0yNi41ODEsNDYuOTE0LTE4LjE3YzguMzI5LDguNDEyLTAuNTA2LDI4Ljg1NS0xNy4zNTcsNDUuNTU2IGMtMTYuODUsMTYuNzAzLTM4LjMwNSwyNy4xMTktNDYuNjM3LDE4LjcwN0MyMy4xNTgsMTI2LjE5MywzMS43MjQsMTA1LjIwOSw0OC41NzYsODguNTA3eiIvPiA8Zz4gPHBhdGggY2xpcC1wYXRoPSJ1cmwoI1hNTElEXzNfKSIgZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGZpbGw9Im5vbmUiIGQ9IiBNNDguNTc2LDg4LjUwNmMxNi44NTItMTYuNzA3LDM4LjU3OC0yNi41OCw0Ni45MTQtMTguMTdjOC4zMjksOC40MTItMC41MDQsMjguODU1LTE3LjM1NSw0NS41NTcgQzYxLjI4MywxMzIuNTk2LDM5LjgyOCwxNDMuMDEsMzEuNDk2LDEzNC42QzIzLjE1OCwxMjYuMTk1LDMxLjcyNCwxMDUuMjA5LDQ4LjU3Niw4OC41MDZ6Ii8+IDxwYXRoIGNsaXAtcGF0aD0idXJsKCNYTUxJRF8zXykiIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBmaWxsPSIjRkZGRkZGIiBkPSJNNDcuODcxLDg3Ljc5NiBjLTEyLjQ3MSwxMi4zNjItMjAuNTU5LDI3LjE2OC0yMC42MDQsMzcuNzE5YzAsMC4wMzEsMCwwLjA2MSwwLDAuMDljMCw0LjA4MiwxLjE4NCw3LjM0NiwzLjUxOCw5LjY5NyBjMi4xMzUsMi4xNTQsNS4wODYsMy4yNTYsOC43NzEsMy4yNzNjMTAuMzQ4LDAuMDQ3LDI1Ljc2OC04LjU3OCwzOS4yODEtMjEuOTczYzE4LjM3OS0xOC4yMTQsMjUuODQtMzguNDA2LDE3LjM2Mi00Ni45NzEgYy0yLjE4OS0yLjIwOS01LjI0NS0zLjMzNy05LjA4MS0zLjM1NEM3Ni42NzEsNjYuMjMzLDYwLjg5OSw3NC44OCw0Ny44NzEsODcuNzk2eiBNMzkuNTY2LDEzNi41NzYgYy0zLjEzMS0wLjIwMS01LjYxMy0wLjkxNi03LjM2LTIuNjgyYy0xLjk2NS0xLjk4LTIuOTUzLTQuNzk1LTIuOTM4LTguMzY5YzAuMDQzLTEwLjA0OSw3Ljg5Ny0yNC4zMDEsMjAuMDEyLTM2LjMwOSBjMTIuNjc2LTEyLjU2NywyNy41NDktMjAuMDU5LDM3LjUtMjAuMDE2YzMuMjg2LDAuMDE1LDUuODY2LDAuOTQ0LDcuNjY4LDIuNzYzYzcuNTUxLDcuNjI2LDAuNDQ1LDI2Ljc3OC0xNi44MzQsNDMuOTA0IEM2NC42NTgsMTI4LjcwNyw1MS45NDUsMTM3LjM2NywzOS41NjYsMTM2LjU3NnogTTQ3Ljg3MSw4Ny43OTZ6Ii8+IDwvZz4gPHBhdGggY2xpcC1wYXRoPSJ1cmwoI1hNTElEXzNfKSIgZmlsbD0iI0ZGRkZGRiIgZD0iTTEwMC4xMDQsNzUuODQ2bC0yLjIxOC0xNS44NWw0LjYzNSwxNS4yODdsNC4yMjMtNC4yOTcgbC0yLjExNyw1LjYxOWwxOC4zNjctMy4yNTFsLTE3LjgwOSw1LjY2OGw1LjM3NSw1LjAzM2wtNi42OTMtMi45MzJsMy4wNTksMjEuMTFsLTUuNDc3LTIwLjU0OGwtNC42NjMsNC43NjVsMi41NTktNi4wODcgTDgxLjk3LDgzLjY3bDE2LjgyLTUuNzIzbC00LjQzNi00LjMzMUwxMDAuMTA0LDc1Ljg0NnoiLz4gPC9nPiA8Zz4gPHBhdGggZmlsbD0iI0ZGRkZGRiIgZD0iTTY0LjgzMiw0My44MThjMCwzLjMyOSwwLjMwNyw1LjU4NCwwLjkyLDYuNzY4YzAuNjE1LDEuMTgyLDEuODI0LDEuODYxLDMuNjMxLDIuMDM2IGMwLjczNiwwLjA3MSwxLjEwNSwwLjM1OCwxLjEwNSwwLjg1OHMtMC4yOTksMC43NS0wLjg5NiwwLjc1Yy0wLjE5MywwLTAuNTUzLTAuMDI1LTEuMDgtMC4wNzUgYy0xLjUxLTAuMTE2LTIuOTY3LTAuMTc1LTQuMzczLTAuMTc1Yy0xLjE3NiwwLTIuMjIxLDAuMDMzLTMuMTM1LDAuMTAybC0yLjIxMywwLjIwMmwtMS43NjYsMC4xNTEgYy0wLjQ5LDAuMDUxLTAuODM0LDAuMDc2LTEuMDI3LDAuMDc2Yy0wLjYzMSwwLTAuOTQ3LTAuMjQtMC45NDctMC43MjFjMC0wLjM5MywwLjE3Ni0wLjY0MSwwLjUyNy0wLjc0OCBjMS4xOTUtMC4zNjgsMi4wMjEtMC44NjMsMi40NzktMS40ODZzMC42ODYtMS41NzQsMC42ODYtMi44NTR2LTIuNWwwLjAyNy0xLjAyNlYyNi4xMjhjMC0yLjEwNC0wLjI2NC0zLjUxNi0wLjc5MS00LjIzNiBjLTAuODYzLTEuMTc1LTIuMjctMS44ODUtNC4yMjEtMi4xMzFjLTAuNzIzLTAuMTA2LTEuMDgyLTAuNDA5LTEuMDgyLTAuOTA4YzAtMC40OTksMC4yNDYtMC43NDgsMC43MzgtMC43NDggYzAuMTkzLDAsMC41MSwwLjAyNiwwLjk0OSwwLjA3N2MxLjM1NCwwLjEzNywyLjgzOCwwLjIwNSw0LjQ1NSwwLjIwNWMxLjc3NSwwLDMuOTI4LTAuMDk1LDYuNDU5LTAuMjg3IGMyLjk2OS0wLjIyNiw1LjAxOC0wLjMzOCw2LjE0My0wLjMzOGMzLjMzOCwwLDYuMTA3LDAuOTExLDguMzA1LDIuNzMxYzIuMTk1LDEuODIxLDMuMjk1LDQuMTEyLDMuMjk1LDYuODc0IGMwLDEuNzQyLTAuNDg4LDMuMzI1LTEuNDYzLDQuNzVjLTAuOTc3LDEuNDI1LTIuMzE2LDIuNTA3LTQuMDIsMy4yNDVjLTAuMzUyLDAuMTQxLTAuNTIsMC4zMTctMC41MDIsMC41MjggYzAuMDE4LDAuMTc2LDAuMTA1LDAuMzg2LDAuMjY0LDAuNjMyYzAuMTU4LDAuMjQ2LDAuMzk2LDAuNjU4LDAuNzEzLDEuMjM3bDIuMzQ4LDQuMTU5bDIuNzE3LDQuODE3IGMwLjkzMiwxLjYzMiwxLjc2NCwyLjc2NCwyLjQ5NCwzLjM5NmMwLjcyOSwwLjYzMiwxLjU4NiwwLjk0NywyLjU3MiwwLjk0N2MwLjQwNCwwLDAuNzgxLTAuMDM1LDEuMTM1LTAuMTA1IGMwLjIxMS0wLjA1MiwwLjQwNC0wLjA3OSwwLjU4LTAuMDc5YzAuMzE2LDAsMC40NzUsMC4yMDMsMC40NzUsMC42MDVjMCwwLjUxLTAuNzE5LDEuMDg3LTIuMTUyLDEuNzMyIGMtMS40MzYsMC42NDYtMi43MDcsMC45NjktMy44MTYsMC45NjljLTEuODExLDAtMy40OC0wLjg4Ni01LjAwOC0yLjY1OGMtMS41MjktMS43NzItMy41MTYtNS4xMjQtNS45NTctMTAuMDU1IGMtMC45NDktMS45NDgtMS43My0zLjE4MS0yLjM0Ni0zLjY5OHMtMS42MTctMC43NzYtMy4wMDYtMC43NzZoLTEuNjMzbC0xLjE4OCwwLjIxYy0wLjI2NCwwLjE0LTAuMzk1LDAuNTYxLTAuMzk1LDEuMjYxVjQzLjgxOHogTTY0LjgzMiwyMy4yMzh2OS4xMjZjMCwxLjEyNSwwLjE0NSwxLjgzOCwwLjQzNiwyLjEzN2MwLjI4OSwwLjI5OSwwLjk4LDAuNDQ4LDIuMDcsMC40NDhjMy4xMjksMCw1LjA2OC0wLjA1Nyw1LjgxNC0wLjE3MSBjMC43NDgtMC4xMTQsMS40NDctMC40NywyLjA5OC0xLjA2OGMxLjI4My0xLjE2LDEuOTI2LTIuNzYsMS45MjYtNC44YzAtMi42NTUtMC44NjctNC44NDktMi41OTgtNi41ODEgYy0xLjczMi0xLjczMi0zLjkzNi0yLjU5OC02LjYwNy0yLjU5OGMtMS4xOTUsMC0yLjAxOCwwLjI1MS0yLjQ2NywwLjc1MkM2NS4wNTYsMjAuOTgzLDY0LjgzMiwyMS45MDIsNjQuODMyLDIzLjIzOHoiLz4gPHBhdGggZmlsbD0iI0ZGRkZGRiIgZD0iTTExNC4zMTYsMzIuMTAzdjE2LjMyMmMwLDEuNjg1LDAuMTQxLDIuNzI2LDAuNDIyLDMuMTJzMS4wMzcsMC41OTIsMi4yNjgsMC41OTIgbDAuNjA1LTAuMDI2YzAuMjExLDAsMC4zNjksMC4wMTksMC40NzUsMC4wNTRjMC4yOTksMC4xMDcsMC40NDksMC4zMDUsMC40NDksMC41OTJjMCwwLjYyOS0wLjYsMC45NDMtMS43OTksMC45NDNoLTEuMjcgYy0wLjcyMywwLTEuMjg3LDAuMDE4LTEuNjkzLDAuMDUyYy0xLjA3NiwwLjA2OS0yLjMyOCwwLjI3Ni0zLjc1NiwwLjYyYy0wLjE3NiwwLjA1My0wLjMzNiwwLjA3OC0wLjQ3NywwLjA3OCBjLTAuMzg3LDAtMC41OC0wLjMyNC0wLjU4LTAuOTczYzAtMC4zNSwwLjAxOC0wLjY0OCwwLjA1My0wLjg5M2MwLjAzNS0wLjM1MSwwLjA1My0wLjYxMywwLjA1My0wLjc4OSBjMC0wLjUyNS0wLjExNS0wLjc5Ny0wLjM0NC0wLjgxNGMtMC4wODgsMC0wLjIyOSwwLjEwNS0wLjQyLDAuMzE1bC0wLjk0OSwwLjk3NGMtMS42MTMsMS42ODItMy41NTMsMi41MjMtNS44MTYsMi41MjMgYy0yLjU5NiwwLTQuNTUzLTAuNzIxLTUuODctMi4xNjJjLTEuMzE2LTEuNDQtMS45NzUtMy41NzYtMS45NzUtNi40MDVjMC0zLjc0MywwLjA3LTYuOTg1LDAuMjExLTkuNzI3IGMwLjAxOC0wLjQ5MiwwLjAyNS0wLjkxNCwwLjAyNS0xLjI2NWMwLTEuMTk1LTAuNTE4LTEuODM2LTEuNTU3LTEuOTI0bC0xLjA1Ny0wLjA3OWMtMC40OTItMC4wMzUtMC43MjEtMC4yNzMtMC42ODYtMC43MTUgYzAuMDE4LTAuMzM1LDAuMjg1LTAuNTYxLDAuODA3LTAuNjc1YzAuNTItMC4xMTUsMS41Mi0wLjE3MiwzLTAuMTcyYzEuMzc1LDAsMi42LTAuMTc3LDMuNjc0LTAuNTMxIGMwLjQ3Ny0wLjE0MSwwLjg0Ni0wLjIxMSwxLjEwOS0wLjIxMWMwLjI5OSwwLDAuNDQ5LDAuMjAyLDAuNDQ5LDAuNjA2YzAsMC40NzQtMC4wMTgsMC45NTctMC4wNTMsMS40NDggYy0wLjE1OCwxLjg2MS0wLjIzNiw1LjExOC0wLjIzNiw5Ljc3MWMwLDMuNTgyLDAuMzI0LDUuOTc0LDAuOTcyLDcuMTc2YzAuNjQ3LDEuMjAyLDEuOTQ0LDEuODA0LDMuODkyLDEuODA0IGMxLjUyMywwLDIuNjk5LTAuNDUzLDMuNTIzLTEuMzU5czEuMjM2LTIuMjEsMS4yMzYtMy45MTN2LTkuODJjMC0xLjQ5Mi0wLjEzNy0yLjQwOS0wLjQxLTIuNzUxIGMtMC4yNzEtMC4zNDItMS4wNDEtMC41OTItMi4zMDUtMC43NWMtMC41NDUtMC4wNTMtMC44MTYtMC4yNjctMC44MTYtMC42NDFjMC0wLjU1MiwwLjUyNy0wLjgyOCwxLjU4NC0wLjgyOCBjMy4wNjEsMCw1LjE4Mi0wLjIwNyw2LjM2MS0wLjYyMWMwLjIyOS0wLjA4NiwwLjQxNC0wLjEyOSwwLjU1NS0wLjEyOWMwLjI0Ni0wLjAxOCwwLjM2OSwwLjE1OCwwLjM2OSwwLjUyNkwxMTQuMzE2LDMyLjEwM3oiLz4gPHBhdGggZmlsbD0iI0ZGRkZGRiIgZD0iTTEyOC4xNDMsMzUuNzA4YzAsMC4yNDYsMC4wNjEsMC4zNzcsMC4xODQsMC4zOTVsMC4yNjQtMC4yOSBjMS43ODktMi43MDEsNC4yMzMtNC4wNTIsNy4zMzgtNC4wNTJjMi43MDEsMCw0Ljg4MSwwLjkwNiw2LjUzOSwyLjcxN2MxLjY1NSwxLjgxMiwyLjQ4NSw0LjE5NSwyLjQ4NSw3LjE0OSBjMCwzLjgzNC0xLjEyNSw2Ljk4Ny0zLjM3NCw5LjQ1OGMtMi4yNSwyLjQ3Mi01LjExNSwzLjcwNy04LjU5NSwzLjcwN2MtMS4yMTMsMC0yLjQ3Mi0wLjIwMy0zLjc4Mi0wLjYwOSBjLTEuMzA5LTAuNDA1LTIuMzE2LTAuOTA4LTMuMDE4LTEuNTA4Yy0wLjIyOS0wLjIxMy0wLjM5Ni0wLjMxLTAuNTAyLTAuMjkyYy0wLjE3NiwwLjAxOC0wLjU1MywwLjQyMS0xLjEzMywxLjIxMSBjLTAuNzAxLDAuOTQ4LTEuMTg0LDEuNDMxLTEuNDQ3LDEuNDQ4Yy0wLjI4MSwwLjAxOC0wLjQyLTAuMjItMC40Mi0wLjcxMWMwLTAuMzE2LDAuMDE4LTAuNzQ3LDAuMDUzLTEuMjkyIGMwLjEwNS0xLjI0NywwLjE1OC0yLjE4NywwLjE1OC0yLjgxOVYyNC4wNWMwLTEuMjgyLTAuMjI1LTIuMjEzLTAuNjc0LTIuNzkzYy0wLjQ0Ny0wLjU4LTEuMTgyLTAuODctMi4yMDEtMC44NyBjLTAuMzM0LDAtMC41LTAuMTk2LTAuNS0wLjU4N2MwLTAuMzU1LDAuMjAxLTAuNTg3LDAuNjA3LTAuNjk0bDEuNjctMC4zNjljMS42MDUtMC4zODYsMy40NTEtMS4yMSw1LjUzNS0yLjQ3NCBjMC4xNTYtMC4wODcsMC4zMDUtMC4xNCwwLjQ0NS0wLjE1OGMwLjI0NC0wLjAxOCwwLjM2NywwLjQ1NywwLjM2NywxLjQyM1YzNS43MDh6IE0xMjguMTQzLDM4LjEwOXYxMC4xNTkgYzAsMC44MjcsMC40NzEsMS43NzcsMS40MTYsMi44NWMxLjI5NSwxLjUxNCwyLjkxMywyLjI3LDQuODU1LDIuMjdjMS44MzgsMCwzLjMwMy0wLjcyNiw0LjM5Ni0yLjE3N3MxLjY0My0zLjQwOCwxLjY0My01Ljg3MSBjMC0yLjkzOC0wLjcyNy01LjM4My0yLjE4LTcuMzM1cy0zLjI3My0yLjkyOS01LjQ2LTIuOTI5QzEzMC42OTcsMzUuMDc0LDEyOS4xMzksMzYuMDg2LDEyOC4xNDMsMzguMTA5eiIvPiA8cGF0aCBmaWxsPSIjRkZGRkZGIiBkPSJNMTU1LjMyOCwzNy42NjRsNC40OTQsOC41NjRjMC40MjQsMC43OTEsMC43MzIsMS4xODYsMC45MjYsMS4xODYgYzAuMjY0LDAsMC42Ni0wLjY2LDEuMTg4LTEuOThsMS4xODktMi45NTdjMS4xOTctMy4wMSwxLjc5NS01LjE2NiwxLjc5NS02LjQ2OWMwLTAuNjE2LTAuMjYtMS4xODMtMC43NzktMS43MDMgYy0wLjUyMS0wLjUxOS0xLjE2LTAuODY3LTEuOTE4LTEuMDQzYy0wLjQ3Ny0wLjA4Ny0wLjcyMy0wLjI3LTAuNzQtMC41NDljLTAuMDE4LTAuMzg0LDAuMTc2LTAuNTc2LDAuNTgyLTAuNTc2IGMwLjE5MywwLDAuNDg0LDAuMDE3LDAuODcxLDAuMDUxYzEuNDYzLDAuMTUzLDIuNzMsMC4yMywzLjgwNSwwLjIzYzAuOTg2LDAsMS43NzktMC4wMzYsMi4zNzktMC4xMDcgYzAuNDM5LTAuMDU0LDAuNzM4LTAuMDgxLDAuODk4LTAuMDgxYzAuMzUyLDAsMC41MjcsMC4xOTIsMC41MjcsMC41NzVjMCwwLjM0OS0wLjIyOSwwLjU4NC0wLjY4NiwwLjcwNiBjLTEuMDU1LDAuMjgyLTEuOTUxLDEuMzM3LTIuNjg5LDMuMTY3bC0wLjUyOSwxLjMybC05Ljc1MiwyNC4yNTdjLTAuMjI3LDAuNTQ1LTAuNTc2LDAuODE4LTEuMDQ5LDAuODE4IGMtMC4xNDEsMC0wLjM2Ny0wLjAwOS0wLjY4Mi0wLjAyNmwtMS40NjktMC4xMDVjLTAuMjgxLTAuMDE4LTAuNDEyLTAuMTIzLTAuMzk1LTAuMzE1YzAuMDE4LTAuMTU4LDAuMDk4LTAuMzM0LDAuMjM4LTAuNTI3IGMyLjg3MS0zLjU0OSw0LjMwOS01Ljk3NSw0LjMwOS03LjI3M2MwLTAuMzY5LTAuMTkzLTAuOTM5LTAuNTgtMS43MTNsLTguNDEtMTYuNTc2bC0wLjcxMy0xLjQyMyBjLTAuNDIyLTAuNzczLTEuMDU1LTEuMzE3LTEuOS0xLjYzNGMtMC4zMTYtMC4xMjQtMC40NzUtMC4zLTAuNDc1LTAuNTNjMC0wLjQ1OSwwLjI2NC0wLjY4OSwwLjc5MS0wLjY4OSBjMC4yNDYsMCwwLjUwMiwwLjAxNywwLjc2NiwwLjA1MWMxLjQ5NCwwLjE1MywyLjg1NSwwLjIzLDQuMDg4LDAuMjNjMS42LDAsMy4xOTktMC4wOTcsNC43OTktMC4yOTEgYzAuMjI5LTAuMDM1LDAuNDA0LTAuMDUzLDAuNTI3LTAuMDUzYzAuNDU3LDAsMC42ODYsMC4yMywwLjY4NiwwLjY5YzAsMC4zODktMC4yMTEsMC42MjgtMC42MzUsMC43MTZsLTAuODIsMC4xMzIgYy0wLjk4OCwwLjE3Ni0xLjQ4MiwwLjczOC0xLjQ4MiwxLjY4N0MxNTQuNDgyLDM1LjgxMSwxNTQuNzY0LDM2LjU1NywxNTUuMzI4LDM3LjY2NHoiLz4gPC9nPiA8cGF0aCBmaWxsPSJub25lIiBkPSJNMTk4LjQyNSwyNDMuNzc5SDBWMGgxOTguNDI1VjI0My43Nzl6Ii8+IDwvZz4gPC9zdmc+';

/**
 * Setup format-message for this extension.
 */
const setupTranslations = () => {
    const localeSetup = formatMessage.setup();
    if (localeSetup && localeSetup.translations[localeSetup.locale]) {
        Object.assign(
            localeSetup.translations[localeSetup.locale],
            translations[localeSetup.locale]
        );
    }
};

class SmalrubyRubyBlocks {
    static get EXTENSION_NAME () {
        return 'Ruby';
    }

    static get EXTENSION_ID () {
        return 'smalrubyRuby';
    }

    constructor (runtime) {
        this.runtime = runtime;
        if (formatMessage) setupTranslations();
    }

    getInfo () {
        setupTranslations();
        return {
            id: SmalrubyRubyBlocks.EXTENSION_ID,
            name: formatMessage({
                id: 'smalrubyRuby.categoryName',
                default: 'Ruby',
                description: 'Label for the ruby extension category'
            }),
            blockIconURI: blockIconURI,
            blocks: [
                {
                    opcode: 'methodR',
                    text: formatMessage({
                        id: 'smalrubyRuby.methodR',
                        default: '[STRING] . [METHOD]',
                        description: 'Method that returns a value (string/array/hash)'
                    }),
                    blockType: BlockType.REPORTER,
                    isDynamic: true,
                    disableMonitor: true,
                    arguments: {
                        STRING: {
                            type: ArgumentType.STRING,
                            defaultValue: 'string'
                        },
                        METHOD: {
                            type: ArgumentType.STRING,
                            menu: 'methodRMenu',
                            defaultValue: 'delete'
                        },
                        ARG1: {
                            type: ArgumentType.STRING,
                            defaultValue: 'arg1'
                        }
                    },
                    argumentsByMethod: {
                        reverse: {
                            text: '\u6587\u5b57\u5217 [STRING] . [METHOD]',
                            arguments: {
                                STRING: {type: ArgumentType.STRING, defaultValue: 'string'},
                                METHOD: {
                                    type: ArgumentType.STRING,
                                    menu: 'methodRMenu',
                                    defaultValue: 'reverse'
                                }
                            }
                        },
                        delete: {
                            text: '\u6587\u5b57\u5217 [STRING] . [METHOD] ( [ARG1] )',
                            arguments: {
                                STRING: {type: ArgumentType.STRING, defaultValue: 'string'},
                                METHOD: {
                                    type: ArgumentType.STRING,
                                    menu: 'methodRMenu',
                                    defaultValue: 'delete'
                                },
                                ARG1: {type: ArgumentType.STRING, defaultValue: 'arg1'}
                            }
                        },
                        gsub: {
                            text: '\u6587\u5b57\u5217 [STRING] . [METHOD] ( [ARG1] [ARG2] )',
                            arguments: {
                                STRING: {type: ArgumentType.STRING, defaultValue: 'string'},
                                METHOD: {
                                    type: ArgumentType.STRING,
                                    menu: 'methodRMenu',
                                    defaultValue: 'gsub'
                                },
                                ARG1: {type: ArgumentType.STRING, defaultValue: 'arg1'},
                                ARG2: {type: ArgumentType.STRING, defaultValue: 'arg2'}
                            }
                        },
                        lines: {
                            text: '[STRING] . [METHOD]',
                            arguments: {
                                STRING: {type: ArgumentType.STRING, defaultValue: 'string'},
                                METHOD: {
                                    type: ArgumentType.STRING,
                                    menu: 'methodRMenu',
                                    defaultValue: 'lines'
                                }
                            }
                        },
                        max: {
                            text: '[STRING] . [METHOD]',
                            arguments: {
                                STRING: {type: ArgumentType.STRING, defaultValue: 'list'},
                                METHOD: {
                                    type: ArgumentType.STRING,
                                    menu: 'methodRMenu',
                                    defaultValue: 'max'
                                }
                            }
                        },
                        sort: {
                            text: '[STRING] . [METHOD]',
                            arguments: {
                                STRING: {type: ArgumentType.STRING, defaultValue: 'list'},
                                METHOD: {
                                    type: ArgumentType.STRING,
                                    menu: 'methodRMenu',
                                    defaultValue: 'sort'
                                }
                            }
                        },
                        join: {
                            text: '[STRING] . [METHOD] ( [ARG1] )',
                            arguments: {
                                STRING: {type: ArgumentType.STRING, defaultValue: 'list'},
                                METHOD: {
                                    type: ArgumentType.STRING,
                                    menu: 'methodRMenu',
                                    defaultValue: 'join'
                                },
                                ARG1: {type: ArgumentType.STRING, defaultValue: ''}
                            }
                        },
                        keys: {
                            text: '[STRING] . [METHOD]',
                            arguments: {
                                STRING: {type: ArgumentType.STRING, defaultValue: 'hash'},
                                METHOD: {
                                    type: ArgumentType.STRING,
                                    menu: 'methodRMenu',
                                    defaultValue: 'keys'
                                }
                            }
                        },
                        values: {
                            text: '[STRING] . [METHOD]',
                            arguments: {
                                STRING: {type: ArgumentType.STRING, defaultValue: 'hash'},
                                METHOD: {
                                    type: ArgumentType.STRING,
                                    menu: 'methodRMenu',
                                    defaultValue: 'values'
                                }
                            }
                        }
                    },
                    menuItems: {
                        methodRMenu: [
                            ['reverse', 'reverse'], ['delete', 'delete'], ['gsub', 'gsub'], ['lines', 'lines'],
                            ['max', 'max'], ['sort', 'sort'], ['join', 'join'],
                            ['keys', 'keys'], ['values', 'values']
                        ]
                    }
                },
                {
                    opcode: 'methodC',
                    text: formatMessage({
                        id: 'smalrubyRuby.methodC',
                        default: '[STRING] . [METHOD]',
                        description: 'Method that modifies a variable in place (string/array/hash)'
                    }),
                    blockType: BlockType.COMMAND,
                    isDynamic: true,
                    arguments: {
                        STRING: {
                            type: ArgumentType.STRING,
                            menu: 'variableNames',
                            defaultValue: ' '
                        },
                        METHOD: {
                            type: ArgumentType.STRING,
                            menu: 'methodCMenu',
                            defaultValue: 'delete!'
                        },
                        ARG1: {
                            type: ArgumentType.STRING,
                            defaultValue: 'arg1'
                        }
                    },
                    argumentsByMethod: {
                        'delete!': {
                            text: '\u6587\u5b57\u5217 [STRING] . [METHOD] ( [ARG1] )',
                            arguments: {
                                STRING: {type: ArgumentType.STRING, menu: 'variableNames', defaultValue: ' '},
                                METHOD: {
                                    type: ArgumentType.STRING,
                                    menu: 'methodCMenu',
                                    defaultValue: 'delete!'
                                },
                                ARG1: {type: ArgumentType.STRING, defaultValue: 'arg1'}
                            }
                        },
                        'gsub!': {
                            text: '\u6587\u5b57\u5217 [STRING] . [METHOD] ( [ARG1] [ARG2] )',
                            arguments: {
                                STRING: {type: ArgumentType.STRING, menu: 'variableNames', defaultValue: ' '},
                                METHOD: {
                                    type: ArgumentType.STRING,
                                    menu: 'methodCMenu',
                                    defaultValue: 'gsub!'
                                },
                                ARG1: {type: ArgumentType.STRING, defaultValue: 'arg1'},
                                ARG2: {type: ArgumentType.STRING, defaultValue: 'arg2'}
                            }
                        },
                        'sort!': {
                            text: '[STRING] . [METHOD]',
                            arguments: {
                                STRING: {type: ArgumentType.STRING, menu: 'variableNames', defaultValue: ' '},
                                METHOD: {
                                    type: ArgumentType.STRING,
                                    menu: 'methodCMenu',
                                    defaultValue: 'sort!'
                                }
                            }
                        },
                        'reverse!': {
                            text: '[STRING] . [METHOD]',
                            arguments: {
                                STRING: {type: ArgumentType.STRING, menu: 'variableNames', defaultValue: ' '},
                                METHOD: {
                                    type: ArgumentType.STRING,
                                    menu: 'methodCMenu',
                                    defaultValue: 'reverse!'
                                }
                            }
                        }
                    },
                    menuItems: {
                        methodCMenu: [['delete!', 'delete!'], ['gsub!', 'gsub!'], ['sort!', 'sort!'], ['reverse!', 'reverse!']]
                    }
                }
            ],
            menus: {
                methodRMenu: {
                    acceptReporters: false,
                    items: [
                        {text: 'reverse', value: 'reverse'},
                        {text: 'delete', value: 'delete'},
                        {text: 'gsub', value: 'gsub'},
                        {text: 'lines', value: 'lines'},
                        {text: 'max', value: 'max'},
                        {text: 'sort', value: 'sort'},
                        {text: 'join', value: 'join'},
                        {text: 'keys', value: 'keys'},
                        {text: 'values', value: 'values'}
                    ]
                },
                methodCMenu: {
                    acceptReporters: false,
                    items: [
                        {text: 'delete!', value: 'delete!'},
                        {text: 'gsub!', value: 'gsub!'},
                        {text: 'sort!', value: 'sort!'},
                        {text: 'reverse!', value: 'reverse!'}
                    ]
                },
                variableNames: {
                    acceptReporters: false,
                    items: 'getVariableNamesMenuItems'
                }
            },
            translationMap: translations
        };
    }

    /**
     * Execute string method that returns a value (REPORTER).
     * @param {object} args - block arguments.
     * @param {string} args.STRING - the target string.
     * @param {string} args.METHOD - the method name.
     * @param {string} args.ARG1 - the first argument.
     * @returns {string} the result string.
     */
    methodR (args) {
        const string = String(args.STRING || '');
        const method = args.METHOD;
        const arg1 = String(args.ARG1 || '');
        const arg2 = (args.ARG2 === undefined) ? undefined : String(args.ARG2);

        // For list methods, data_listcontents provides items as space-separated string.
        // Split into array items for operations.
        const toItems = s => (s === '' ? [] : s.split(' '));

        switch (method) {
        // String methods
        case 'reverse':
            return string.split('').reverse().join('');
        case 'delete':
            return string.split('')
                .filter(c => !arg1.includes(c))
                .join('');
        case 'gsub':
            if (arg2 === undefined) return string;
            return string.replaceAll(arg1, arg2);
        case 'lines':
            return string.split('\n').filter((_, i, a) => i < a.length - 1 || _ !== '')
                .map(l => `${l}\n`).join(' ');
        // Array methods (receiver is list contents string)
        case 'max': {
            const items = toItems(string);
            if (items.length === 0) return '';
            const nums = items.map(Number);
            if (nums.every(n => !isNaN(n))) return String(Math.max(...nums));
            return items.reduce((a, b) => (a > b ? a : b));
        }
        case 'sort': {
            const items = toItems(string);
            const nums = items.map(Number);
            if (nums.every(n => !isNaN(n))) return nums.sort((a, b) => a - b).join(' ');
            return items.sort().join(' ');
        }
        case 'join':
            return toItems(string).join(arg1);
        // Hash methods (receiver is list contents string)
        case 'keys':
        case 'values':
            return string;
        default:
            return string;
        }
    }

    /**
     * Execute string method that modifies a variable in place (COMMAND).
     * STRING is a variable name (from the variableNames menu).
     * @param {object} args - block arguments.
     * @param {string} args.STRING - the variable name.
     * @param {string} args.METHOD - the method name.
     * @param {string} args.ARG1 - the first argument.
     * @param {object} util - block utility object.
     */
    methodC (args, util) {
        const variableName = args.STRING;
        const target = util.target;
        const variable = target.lookupVariableByNameAndType(variableName, Variable.SCALAR_TYPE);
        if (!variable) return;

        const string = String(variable.value || '');
        const method = args.METHOD;
        const arg1 = String(args.ARG1 || '');
        const arg2 = (args.ARG2 === undefined) ? undefined : String(args.ARG2);
        let result;
        switch (method) {
        case 'delete!':
            result = string.split('')
                .filter(c => !arg1.includes(c))
                .join('');
            break;
        case 'gsub!':
            result = (arg2 === undefined) ? string : string.replaceAll(arg1, arg2);
            break;
        case 'sort!':
            result = string; // List sort is handled via list blocks
            break;
        case 'reverse!':
            result = string.split('').reverse().join('');
            break;
        default:
            result = string;
        }
        variable.value = result;
    }

    /**
     * Get variable names for the variableNames menu.
     * @returns {Array<string>} list of variable names.
     */
    getVariableNamesMenuItems () {
        const sprite = this.runtime.getEditingTarget();
        if (!sprite) return [' '];
        return [' '].concat(sprite.getAllVariableNamesInScopeByType(Variable.SCALAR_TYPE));
    }
}

module.exports = SmalrubyRubyBlocks;
