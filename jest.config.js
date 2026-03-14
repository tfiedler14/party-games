module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^firebase/(.*)$': '<rootDir>/tests/__mocks__/firebase/$1',
  },
};
