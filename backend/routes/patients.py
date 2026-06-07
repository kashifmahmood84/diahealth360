"""Patient selector data."""
from flask import Blueprint, jsonify
from ..db import query
patients_bp = Blueprint("patients", __name__)

@patients_bp.route("/api/patients")
def patients():
    return jsonify(query("""
        SELECT patient_key, patient_id, full_name, age_years, gender, mrn
        FROM gold_dim_patient WHERE is_current=1
        ORDER BY full_name"""))
