function findInsertIndex(arr, value) {
  let left = 0;
  let right = arr.length;

  while (left < right) {
    const mid = (left + right) >> 1;
    if (arr[mid] < value) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  return left;
}

module.exports = findInsertIndex;