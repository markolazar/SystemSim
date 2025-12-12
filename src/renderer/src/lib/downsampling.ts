/**
 * Largest-Triangle-Three-Buckets (LTTB) downsampling algorithm
 * Intelligently reduces data points while preserving the shape of the data
 * Reference: https://github.com/sveinn-steinarsson/flot-downsample
 */

export interface Point {
    ts: number
    value: number
}

export function downsampleLTTB(data: Point[], threshold: number): Point[] {
    if (data.length <= threshold) {
        return data
    }

    const bucketSize = (data.length - 2) / (threshold - 2)
    const downsampled: Point[] = []

    // Always keep the first point
    downsampled.push(data[0])

    for (let i = 0; i < threshold - 2; i++) {
        const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1
        const avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1
        const avgRangeLength = avgRangeEnd - avgRangeStart

        let avgX = 0
        let avgY = 0

        // Calculate average point in next bucket
        for (let j = avgRangeStart; j < avgRangeEnd && j < data.length; j++) {
            avgX += data[j].ts
            avgY += data[j].value
        }
        avgX /= avgRangeLength
        avgY /= avgRangeLength

        // Find point with largest triangle
        const rangeStart = Math.floor(i * bucketSize) + 1
        const rangeEnd = Math.floor((i + 1) * bucketSize) + 1

        let maxArea = -1
        let maxAreaPoint = -1

        const prevPoint = downsampled[downsampled.length - 1]

        for (let j = rangeStart; j < rangeEnd && j < data.length; j++) {
            const area = Math.abs(
                (prevPoint.ts - data[j].ts) * (avgY - prevPoint.value) -
                (prevPoint.ts - avgX) * (data[j].value - prevPoint.value)
            ) * 0.5

            if (area > maxArea) {
                maxArea = area
                maxAreaPoint = j
            }
        }

        if (maxAreaPoint !== -1) {
            downsampled.push(data[maxAreaPoint])
        }
    }

    // Always keep the last point
    downsampled.push(data[data.length - 1])

    return downsampled
}

/**
 * Calculate optimal threshold (target point count) based on container width
 * Assuming ~2-4 pixels per point for readable charts
 */
export function calculateOptimalThreshold(containerWidth: number): number {
    const pixelsPerPoint = 3
    const threshold = Math.max(100, Math.ceil(containerWidth / pixelsPerPoint))
    return threshold
}
