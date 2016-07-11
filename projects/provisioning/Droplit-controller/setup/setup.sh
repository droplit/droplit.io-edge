echo "Running first time setup script..."
sudo rm /etc/salt/minion
sudo node setup.js
sudo service salt-minion restart
sudo cp /home/pi/droplitcontroller/upstart/droplit.conf /etc/init
sudo service droplit start
echo "Setup complete!"
sudo rm /etc/init/droplit-setup.conf 
sudo service droplit-setup stop