## pgvector-cluster

use this module to do cluster scans of your pgvector vectors. The outcome will be a cluster_id associated with each vector to identify groups of data.

Note: at this point pgvector-cluster can only do DBSCAN clustering

### install

`npm install @davepreston/pgvector-cluster`

### prereqs

- have a table of pgvector vectors
- identify epsilon and minPoints for your initial run (DBSCAN explanation)

### usage

- create a table or columns in existing tables to store cluster info.
  - details here

```javascript
const { scan } = require('@davepreston/pgvector-cluster');

scan({ name: 'first run', epsilon: 0.03, minPoints: 5 });
```

### how does DBSCAN work?
DBSCAN
- loop through each vector in your dataset
- find vectors within `epsilon` of each vector
- if there are at least `minPoints` vectors within range, those vectors become part of the cluster, and the point in question becomes a `core` point 

provide link to more details

### next steps

- more configuration options
- better documentation
- expand to other culster algorithms besides DBSCAN
- performance improvements
