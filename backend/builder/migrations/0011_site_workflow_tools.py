import builder.models
import django.db.models.deletion
import secrets
import uuid
from django.db import migrations, models


def populate_site_tokens(apps, schema_editor):
    Site = apps.get_model('builder', 'Site')
    for site in Site.objects.all().only('id'):
        Site.objects.filter(pk=site.pk).update(
            review_token=uuid.uuid4(),
            domain_verification_token=secrets.token_urlsafe(24),
        )


class Migration(migrations.Migration):
    dependencies = [('builder', '0010_siteversion_pinned')]

    operations = [
        migrations.AddField(
            model_name='site', name='site_options',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='site', name='review_token',
            field=models.UUIDField(editable=False, null=True),
        ),
        migrations.AddField(
            model_name='site', name='custom_domain',
            field=models.CharField(blank=True, db_index=True, default='', max_length=253),
        ),
        migrations.AddField(
            model_name='site', name='domain_status',
            field=models.CharField(choices=[('not_connected', 'Not connected'), ('pending', 'Pending DNS'), ('connected', 'Connected')], default='not_connected', max_length=16),
        ),
        migrations.AddField(
            model_name='site', name='domain_verification_token',
            field=models.CharField(blank=True, default='', editable=False, max_length=64),
        ),
        migrations.RunPython(populate_site_tokens, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='site', name='review_token',
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name='site', name='domain_verification_token',
            field=models.CharField(default=builder.models._domain_verification_token, editable=False, max_length=64),
        ),
        migrations.CreateModel(
            name='FormSubmission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('data', models.JSONField(default=dict)),
                ('page', models.CharField(blank=True, default='', max_length=140)),
                ('is_read', models.BooleanField(db_index=True, default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('site', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='form_submissions', to='builder.site')),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='SiteVisit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('path', models.CharField(blank=True, default='', max_length=180)),
                ('referrer', models.CharField(blank=True, default='', max_length=253)),
                ('device', models.CharField(choices=[('mobile', 'Mobile'), ('tablet', 'Tablet'), ('desktop', 'Desktop')], default='desktop', max_length=10)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('site', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='visits', to='builder.site')),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='ReviewComment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('author_name', models.CharField(max_length=80)),
                ('author_email', models.EmailField(blank=True, default='', max_length=254)),
                ('page_id', models.CharField(blank=True, default='', max_length=140)),
                ('body', models.CharField(max_length=1200)),
                ('resolved', models.BooleanField(db_index=True, default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('site', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='review_comments', to='builder.site')),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.AddIndex(model_name='formsubmission', index=models.Index(fields=['site', 'is_read', '-created_at'], name='builder_for_site_id_c29f5f_idx')),
        migrations.AddIndex(model_name='sitevisit', index=models.Index(fields=['site', '-created_at'], name='builder_sit_site_id_d29cb4_idx')),
        migrations.AddIndex(model_name='reviewcomment', index=models.Index(fields=['site', 'resolved', '-created_at'], name='builder_rev_site_id_4262eb_idx')),
    ]
