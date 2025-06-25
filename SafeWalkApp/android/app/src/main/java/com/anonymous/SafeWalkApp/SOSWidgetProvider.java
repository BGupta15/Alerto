package com.safewalk;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class SOSWidgetProvider extends AppWidgetProvider {
    public static final String SOS_CLICKED = "com.safewalk.SOS_CLICKED";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            Intent intent = new Intent(context, SOSWidgetProvider.class);
            intent.setAction(SOS_CLICKED);
            PendingIntent pendingIntent = PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_IMMUTABLE);

            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.sos_widget);
            views.setOnClickPendingIntent(R.id.sosButton, pendingIntent);

            appWidgetManager.updateAppWidget(id, views);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (SOS_CLICKED.equals(intent.getAction())) {
            Intent serviceIntent = new Intent(context, SOSWidgetService.class);
            context.startService(serviceIntent);
        }
    }
}
