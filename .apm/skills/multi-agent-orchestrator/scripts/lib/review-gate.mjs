export function evaluateReviewGate(reviews) {
  const rejected = reviews.filter(item => !item.approved)
  return {
    passed: rejected.length === 0,
    rejected,
  }
}
