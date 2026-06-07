"""API blueprints. Add one per screen as you build; warehouse + patients exist now."""
from .warehouse import warehouse_bp
from .patients import patients_bp
ALL_BLUEPRINTS = [warehouse_bp, patients_bp]
