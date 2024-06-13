# dist-link-checker

A simple tool to check for broken links in static `dist/` directory.


```javascript
import validateFolder from 'dist-link-checker';

const result = await validateFolder({dir: 'dist/'});

if (!result.ok) {
    throw new Error('Link checker failed. Fix yo links.');
}
```
