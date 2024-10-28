## @davepreston/pgvector-cluster

use this module to do cluster scans of your pgvector vectors. The outcome will be a cluster_id associated with each vector to identify groups of data.

Note: at this point pgvector-cluster can only do DBSCAN clustering

### install

`npm install @davepreston/pgvector-cluster`

### prereqs

- have a table of pgvector vectors
- identify epsilon and minPoints for your initial run (DBSCAN explanation)
- A table to store cluster info. (will be created if not there)

### usage

scan 
```javascript
const { scan } = require('@davepreston/pgvector-cluster');

scan({
  vectorTable: 'embedding',
  clusterTable: 'point',
  name: 'first run',
  epsilon: 0.03,
  minPoints: 5,
});
```

### optional table creation
- It will create a new table using this sql if you don't create one beforehand.
```sql
CREATE TABLE IF NOT EXISTS point (
    id SERIAL PRIMARY KEY,
    scan_name TEXT NOT NULL, -- must be unique scan_name for this scan
    embedding_id INTEGER NOT NULL, -- connects to the vector table
    assessed BOOLEAN NOT NULL DEFAULT false, -- scan will continue until all records are true with matching scan_name
    cluster_id INTEGER, -- null means no cluster
    type TEXT, -- 'core' if a point is considered a core by DBSCAN
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
)
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
