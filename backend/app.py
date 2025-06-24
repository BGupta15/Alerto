from flask import Flask, request, jsonify, render_template,redirect
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

app = Flask(__name__)
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///alerts.db'
db = SQLAlchemy(app)

class Alert(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(50))
    notes = db.Column(db.String(255))
    lat = db.Column(db.Float)
    lon = db.Column(db.Float)
    contact = db.Column(db.String(15))

    def serialize(self):
        return {
            "id": self.id,
            "name": self.name,
            "timestamp": self.timestamp.isoformat(),
            "status": self.status,
            "notes": self.notes,
            "lat": self.lat,
            "lon": self.lon,
            "contact": self.contact
        }

# MANUAL DB creation (no decorator!)
with app.app_context():
    db.create_all()

@app.route('/')
def map():
    return render_template('index.html')

@app.route("/api/alerts", methods=["GET"])
def get_alerts():
    alerts = Alert.query.order_by(Alert.timestamp.desc()).all()
    return jsonify([a.serialize() for a in alerts])

@app.route("/api/trigger-sos", methods=["POST"])
def trigger_sos():
    data = request.json
    new_alert = Alert(
        name=data.get("name", "Unknown"),
        status="No Response",
        notes=data.get("notes", ""),
        lat=data.get("lat"),
        lon=data.get("lon"),
        contact=data.get("contact")
    )
    db.session.add(new_alert)
    db.session.commit()
    return jsonify({"message": "SOS alert triggered!"}), 201

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=3000)

