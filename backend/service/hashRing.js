import crypto from 'crypto';

export class ConsistentHashRing {
  constructor(nodes = [], replicas = 50) {
    this.replicas = replicas; // Virtual nodes per physical worker
    this.ring = new Map(); // Maps hash -> physical workerId
    this.sortedKeys = []; // Sorted array of hash values

    nodes.forEach((node) => this.addNode(node));
  }

  // Hashes any string into a 32-bit unsigned integer
  hash(key) {
    return crypto
      .createHash('md5')
      .update(String(key))
      .digest()
      .readUInt32BE(0);
  }

  addNode(nodeId) {
    for (let i = 0; i < this.replicas; i++) {
      const vNodeKey = `${nodeId}#vnode${i}`;
      const hash = this.hash(vNodeKey);
      this.ring.set(hash, nodeId);
      this.sortedKeys.push(hash);
    }
    this.sortedKeys.sort((a, b) => a - b);
  }

  removeNode(nodeId) {
    this.sortedKeys = this.sortedKeys.filter((hash) => {
      if (this.ring.get(hash) === nodeId) {
        this.ring.delete(hash);
        return false;
      }
      return true;
    });
  }

  // Returns the physical worker assigned to a specific monitor ID
  getNode(monitorId) {
    if (this.sortedKeys.length === 0) return null;

    const hash = this.hash(monitorId);

    // Binary search (clockwise search on the ring)
    let low = 0;
    let high = this.sortedKeys.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.sortedKeys[mid] >= hash) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    // Wrap around to index 0 if hash is beyond the highest ring point
    const targetKey =
      low < this.sortedKeys.length ? this.sortedKeys[low] : this.sortedKeys[0];

    return this.ring.get(targetKey);
  }

  // Helper: Checks if this monitor belongs to the current worker
  isAssignedToMe(monitorId, myWorkerId) {
    const assigned = this.getNode(monitorId);
    return assigned === myWorkerId;
  }
}
