"""Generic read-only query endpoint the frontend uses for live data."""
from flask import Blueprint, request, jsonify, abort
from ..db import query
warehouse_bp = Blueprint("warehouse", __name__)

@warehouse_bp.route("/api/warehouse/query", methods=["POST"])
def wh_query():
    body = request.get_json(force=True)
    try:
        return jsonify(query(body.get("sql", ""), body.get("params") or []))
    except Exception as e:
        abort(400, str(e))
