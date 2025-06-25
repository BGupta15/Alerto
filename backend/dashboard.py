import streamlit as st
import pandas as pd
import sqlite3
from datetime import datetime
from streamlit_autorefresh import st_autorefresh
from twilio.rest import Client

TWILIO_SID = "AC91c4df2979105fcf14ce5a446a12d31f"
TWILIO_AUTH = "6528c92e02a3f7b1ecd6199693fea2b1"
TWILIO_PHONE = "+12792057151"  

# Predefined emergency numbers
EMERGENCY_NUMBERS = {
    "Family & Friends": "9711567893",
    "Ambulance": "6395526762",
    "Police": "9354925538"
}

st.set_page_config(page_title="ALERTO Dashboard", layout="wide")
st.title("🚨 ALERTO: Real-Time SOS Dashboard")

DB_PATH = "instance/alerts.db"

# ----------------- DB Helpers ----------------- #
def send_help(name, contact, lat, lon, targets):
    client = Client(TWILIO_SID, TWILIO_AUTH)
    for target in targets:
        number = EMERGENCY_NUMBERS.get(target)
        if number:
            try:
                msg = (
                    f"🚨 SOS Alert!\n"
                    f"{name} ({contact}) needs help!\n"
                    f"📍 {lat:.4f}, {lon:.4f}\n"
                    f"🌐 https://maps.google.com/?q={lat},{lon}"
                )


                message = client.messages.create(
                    body=msg,
                    from_=TWILIO_PHONE,
                    to=f"+91{number}"
                )
                print(f"✅ Sent to {target} ({number}) - SID: {message.sid}")
            except Exception as e:
                print(f"❌ Failed to send to {target}: {e}")
        else:
            print(f"⚠️ No number set for {target}")


def get_connection():
    return sqlite3.connect(DB_PATH)

def fetch_alerts():
    conn = get_connection()
    query = "SELECT * FROM Alert ORDER BY timestamp DESC"
    df = pd.read_sql_query(query, conn)
    conn.close()
    return df

def fetch_alerts_by_contact(ref_id):
    conn = get_connection()
    query = "SELECT * FROM Alert WHERE contact = ? ORDER BY timestamp DESC"
    df = pd.read_sql_query(query, conn, params=(ref_id,))
    conn.close()
    return df

def resolve_alert(alert_id):
    conn = get_connection()
    conn.execute("UPDATE Alert SET status = 'Resolved' WHERE id = ?", (alert_id,))
    conn.commit()
    conn.close()

def delete_alert(alert_id):
    conn = get_connection()
    conn.execute("DELETE FROM Alert WHERE id = ?", (alert_id,))
    conn.commit()
    conn.close()

# ----------------- UI Starts ----------------- #
login_type = st.sidebar.selectbox("Login As", ["Admin", "User"])

if login_type == "Admin":
    admin_id = st.sidebar.text_input("Admin ID")
    admin_pass = st.sidebar.text_input("Password", type="password")

    if admin_id == "admin" and admin_pass == "admin123":
        st_autorefresh(interval=10000, key="admin-refresh")
        df = fetch_alerts()
        st.success("Logged in as Admin ✅")
    else:
        st.warning("Enter valid Admin credentials to continue.")
        st.stop()

elif login_type == "User":
    user_id = st.sidebar.text_input("User ID")
    user_pass = st.sidebar.text_input("Password", type="password")
    ref_id = st.sidebar.text_input("Victim Contact Number")

    if user_id and user_pass and ref_id:
        df = fetch_alerts_by_contact(ref_id)
        st.success(f"Logged in as User ✅ - Viewing alerts for: {ref_id}")
    else:
        st.warning("Enter all user fields to continue.")
        st.stop()

# ----------------- Display Alerts ----------------- #
if df.empty:
    st.warning("No alerts found.")
else:
    total_alerts = len(df)
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors='coerce')
    last_alert_time = df["timestamp"].iloc[0].strftime("%Y-%m-%d %H:%M:%S") if pd.notnull(df["timestamp"].iloc[0]) else "N/A"
    df["timestamp"] = df["timestamp"].apply(lambda x: x.strftime("%Y-%m-%d %H:%M:%S") if pd.notnull(x) else "")

    st.markdown(f"**Total Alerts:** {total_alerts} | **Last Alert:** {last_alert_time}")

    st.subheader("📍 Alert Map")
    st.map(df[['lat', 'lon']])

    st.subheader("🗂️ Alert Details")
    for _, row in df.iterrows():
        with st.expander(f"{row['name']} - {row['status']} - {row['timestamp']}"):
            st.write(f"📞 **Contact:** {row['contact']}")
            st.write(f"🕒 **Timestamp:** {row['timestamp']}")
            st.write(f"📍 **Location:** [{row['lat']}, {row['lon']}]")
            maps_url = f"https://www.google.com/maps/search/?api=1&query={row['lat']},{row['lon']}"
            st.markdown(f"[🌐 Open in Google Maps]({maps_url})", unsafe_allow_html=True)

            # 🟢 YAHI PE paste karo ye block:
            col1, col2, col3 = st.columns(3)

            with col1:
                if st.button("✅ Resolve", key=f"resolve_{row['id']}"):
                    resolve_alert(row['id'])
                    st.experimental_rerun()

            with col2:
                if st.button("🗑️ Delete", key=f"delete_{row['id']}"):
                    delete_alert(row['id'])
                    st.experimental_rerun()

            with col3:
                help_key = f"help_toggle_{row['id']}"
                if help_key not in st.session_state:
                    st.session_state[help_key] = False

                if st.button("📤 Send Help Options", key=f"toggle_{row['id']}"):
                    st.session_state[help_key] = not st.session_state[help_key]

                if st.session_state[help_key]:
                    st.markdown("**Select whom to send help to:**")
                    family = st.checkbox("👪 Family & Friends", key=f"fam_{row['id']}")
                    ambulance = st.checkbox("🚑 Ambulance", key=f"amb_{row['id']}")
                    police = st.checkbox("👮 Police", key=f"pol_{row['id']}")

                    if st.button("🚀 Send Help Now", key=f"sendhelp_{row['id']}"):
                        targets = []
                        if family: targets.append("Family & Friends")
                        if ambulance: targets.append("Ambulance")
                        if police: targets.append("Police")

                        if targets:
                            send_help(row['name'], row['contact'], row['lat'], row['lon'], targets)
                            st.success(f"Help sent to {', '.join(targets)} for {row['name']}")
                            st.session_state[help_key] = False      
                        else:
                            st.warning("Select at least one recipient.")

st.info("🔐 This dashboard allows admin or family users to view and manage real-time SOS alerts.")
