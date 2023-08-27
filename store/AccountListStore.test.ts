import test from 'ava';
import { AccountListStore } from './AccountListStore';
import { MemoryLevel } from 'memory-level';

function newAccountListStore(): AccountListStore {
    return new AccountListStore(new MemoryLevel({ valueEncoding: 'json' }));
}

test('AccountListStore - add and match patterns', async t => {
    const store = newAccountListStore();
    const patterns = ['user1@example.com', '*@example.com'];
    await store.add(patterns);
    
    t.true(await store.matches('user1@example.com'));
    t.true(await store.matches('user2@example.com')); // Wildcard match
    t.false(await store.matches('user2@other.com'));
});

test('AccountListStore - remove patterns', async t => {
    const store = newAccountListStore();
    const patterns = ['user1@example.com', '*@example.com'];
    await store.add(patterns);
    await store.remove(['*@example.com']);

    t.false(await store.matches('user2@example.com')); // Wildcard was removed
    t.true(await store.matches('user1@example.com'));
});
