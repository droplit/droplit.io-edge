#!/bin/bash

# Set git push.default: git config --global push.default simple
# Also cache creds for 15min: git config --global credential.helper cache

# Reset
Color_Off='\033[0m'       # Text Reset

# Regular Colors
Black='\033[0;30m'        # Black
Red='\033[0;31m'          # Red
Green='\033[0;32m'        # Green
Yellow='\033[0;33m'       # Yellow
Blue='\033[0;34m'         # Blue
Purple='\033[0;35m'       # Purple
Cyan='\033[0;36m'         # Cyan
White='\033[0;37m'        # White

header(){
    printf "${Green}\n" 
    echo " _| _ _  _ |.|_   . _  "
    echo "(_|| (_)|_)|||_.o |(_) "
    echo "        |    "
    printf "${Color_Off}\n"
    echo "Droplit.io Edge publish script"
    echo "Â© Droplit, Inc. 2017"
    echo ""
}

prompt(){
    printf "${Yellow}This script should only be run from the deployment virtual machine.${Color_Off}\n"
    sleep 2
    echo "Are you sure you wish to procede?"
    select answer in "Yes" "No"
    do
        case $answer in
            "Yes" ) break;;
            "No" ) exit;;
        esac
    done
}

publish_project(){
    if [ $2 != "none" ]; then
        printf "${Cyan}Bumping version...${Color_Off}\n"
        gulp bump --project $1 --$2
        git add projects/$1/package.json
        git commit -m "Version bumped using publishing script."
        git push
    fi
    printf "${Cyan}Publishing droplit-plugin to npm...${Color_Off}\n"
    cd projects/droplit-plugin
    npm publish
    cd ../../
    printf "${Cyan}Publishing repo to github...${Color_Off}\n"
}

bump_level(){
    echo "What type should the version be bumped?"
    select level in "patch" "minor" "major" "none"
    do
        case $level in
            "patch" ) 
                confirm_publish $level
                break;;
            "minor" ) 
                confirm_publish $level
                break;;
            "major" )
                confirm_publish $level
                break;;
            "none" ) 
                confirm_publish $level
                break;;
        esac
    done
}

confirm_publish(){
    echo "Publishing will version bump the project and publish to github and npm."
    sleep 2
    printf "Are you sure you wish to publish${Purple} droplit-edge ${Color_Off}to Github and${Purple} droplit-plugin ${Color_Off}to npm with version bump type${Purple} $2${Color_Off}?\n"
    select confirm in "Yes" "No"
    do
        case $confirm in
            "Yes" ) 
                publish_project $1 $2
                break;;
            "No" ) exit;;
        esac
    done
}


header
printf "${Cyan}Syncing with git...${Color_Off}\n"
git pull
echo ""
prompt
bump_level
printf "${Green}Complete!${Color_Off}\n"
exit