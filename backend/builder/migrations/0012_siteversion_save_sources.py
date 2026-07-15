from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('builder', '0011_site_workflow_tools')]

    operations = [
        migrations.AlterField(
            model_name='siteversion',
            name='source',
            field=models.CharField(
                choices=[
                    ('save', 'Legacy save'),
                    ('auto', 'Auto save'),
                    ('restore', 'Restore'),
                    ('manual', 'Manual'),
                ],
                default='save',
                max_length=10,
            ),
        ),
    ]
