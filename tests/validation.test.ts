import { expect, test } from 'vitest'

import validateFolder from '../src';

const fixtureDir = __dirname + "/fixtures";


test('registers broken images', async () => {
    const result = await validateFolder({ dir: `${fixtureDir}/broken-img` });

    expect(result.ok).toBe(false);
    expect(result.checkedLinks).toBe(0);
    expect(result.checkedImages).toBe(1);
    expect(result.totalChecked).toBe(1);
    expect(result.brokenLinks).toBe(0);
    expect(result.brokenImages).toBe(1);
    expect(result.totalBroken).toBe(1);
});

test('fires broken image callback', async () => {
    let fired = false;

    await validateFolder({
        dir: `${fixtureDir}/broken-img`,
        onInvalidImage: ({ file, image }) => {
            fired = true;

            expect(file).toBe("/index.html");
            expect(image).toBe("/doesntexist.png");
        }
    });

    expect(fired).toBe(true);
});

test('register broken links', async () => {
    let broken = [];

    const result = await validateFolder({
        dir: `${fixtureDir}/broken-link`,
        onInvalidLink: ({ file, link }) => {
            broken.push({ file, link });
        }
    });

    expect(result.ok).toBe(false);
    expect(result.checkedLinks).toBe(2);
    expect(result.totalChecked).toBe(2);
    expect(result.brokenLinks).toBe(1);
    expect(result.totalBroken).toBe(1);

    expect(broken).toEqual([
        {
            file: "/index.html",
            link: "/broken",
        }
    ]);
});

test('happy with links and images', async () => {
    const result = await validateFolder({ dir: `${fixtureDir}/happy` });

    expect(result.ok).toBe(true);
    expect(result.checkedLinks).toBe(1);
    expect(result.checkedImages).toBe(1);
    expect(result.totalChecked).toBe(2);
    expect(result.brokenLinks).toBe(0);
    expect(result.brokenImages).toBe(0);
    expect(result.totalBroken).toBe(0);
});
