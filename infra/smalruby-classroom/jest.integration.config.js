module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/lambda/tests'],
  testMatch: ['**/*.integration.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  // 外部APIへのリクエストがあるため、タイムアウトを30秒に設定
  testTimeout: 30000,
  // .env から CLASSROOM_API_ENDPOINT などを読み込む
  setupFiles: ['dotenv/config']
};
