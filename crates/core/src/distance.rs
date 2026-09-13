const EARTH_RADIUS_M: f64 = 6_371_000.0;

/// Great-circle distance between two lat/lon points, in meters.
pub fn haversine_distance_m(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    let (lat1_rad, lat2_rad) = (lat1.to_radians(), lat2.to_radians());
    let d_lat = (lat2 - lat1).to_radians();
    let d_lon = (lon2 - lon1).to_radians();

    let h = (d_lat / 2.0).sin().powi(2) + lat1_rad.cos() * lat2_rad.cos() * (d_lon / 2.0).sin().powi(2);

    2.0 * EARTH_RADIUS_M * h.sqrt().asin()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zero_distance_for_identical_points() {
        assert_eq!(haversine_distance_m(51.505, -0.09, 51.505, -0.09), 0.0);
    }

    #[test]
    fn known_distance_between_london_and_paris() {
        // London to Paris is roughly 344 km.
        let d = haversine_distance_m(51.5074, -0.1278, 48.8566, 2.3522);
        assert!((330_000.0..360_000.0).contains(&d), "unexpected distance: {d}");
    }
}
